#define DISCORDPP_IMPLEMENTATION
#include "discordpp.h"

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cstring>
#include <memory>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>

namespace {
constexpr uint64_t kApplicationId = 1481784878197637160ULL;

std::unique_ptr<discordpp::Client> client;
std::mutex clientMutex;
std::mutex stateMutex;
std::atomic<bool> running{false};
std::thread callbackThread;
std::string phase = "starting";
std::string errorMessage;
std::string detectedName;

std::string escapeJson(const std::string& input) {
  std::ostringstream out;
  for (unsigned char c : input) {
    switch (c) {
      case '\\': out << "\\\\"; break;
      case '"': out << "\\\""; break;
      case '\n': out << "\\n"; break;
      case '\r': out << "\\r"; break;
      case '\t': out << "\\t"; break;
      default:
        if (c < 0x20) out << ' ';
        else out << c;
    }
  }
  return out.str();
}

void setState(std::string nextPhase, std::string nextError = {}) {
  std::lock_guard<std::mutex> lock(stateMutex);
  phase = std::move(nextPhase);
  errorMessage = std::move(nextError);
}

const char* statusName(discordpp::StatusType status) {
  switch (status) {
    case discordpp::StatusType::Online: return "online";
    case discordpp::StatusType::Idle: return "idle";
    case discordpp::StatusType::Dnd: return "dnd";
    case discordpp::StatusType::Streaming: return "streaming";
    case discordpp::StatusType::Invisible: return "invisible";
    default: return "offline";
  }
}

void beginDiscordDetection() {
  client->GetDiscordClientConnectedUser(
    kApplicationId,
    [](discordpp::ClientResult result, std::optional<discordpp::UserHandle> user) {
      std::lock_guard<std::mutex> lock(stateMutex);
      if (result.Successful() && user) {
        detectedName = user->DisplayName();
        if (phase == "starting") phase = "available";
      } else if (phase == "starting") {
        phase = "discord_closed";
        errorMessage = result.Error();
      }
    });
}
}  // namespace

extern "C" bool uf_discord_social_init() {
  if (running.exchange(true)) return true;
  try {
    client = std::make_unique<discordpp::Client>();
    client->SetApplicationId(kApplicationId);
    client->SetStatusChangedCallback([](discordpp::Client::Status status,
                                        discordpp::Client::Error,
                                        int32_t) {
      if (status == discordpp::Client::Status::Ready) setState("ready");
      else if (status == discordpp::Client::Status::Reconnecting) setState("reconnecting");
      else if (status == discordpp::Client::Status::Disconnected) {
        std::lock_guard<std::mutex> lock(stateMutex);
        if (phase != "available" && phase != "discord_closed") phase = "disconnected";
      }
    });
    beginDiscordDetection();
    callbackThread = std::thread([] {
      while (running.load()) {
        {
          std::lock_guard<std::mutex> lock(clientMutex);
          if (client) discordpp::RunCallbacks();
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(50));
      }
    });
    return true;
  } catch (const std::exception& error) {
    setState("unavailable", error.what());
    running = false;
    return false;
  }
}

extern "C" void uf_discord_social_shutdown() {
  running = false;
  if (callbackThread.joinable()) callbackThread.join();
  std::lock_guard<std::mutex> lock(clientMutex);
  client.reset();
}

extern "C" bool uf_discord_social_login() {
  std::lock_guard<std::mutex> lock(clientMutex);
  if (!client) return false;
  setState("authorizing");
  auto verifier = client->CreateAuthorizationCodeVerifier();
  auto verifierText = verifier.Verifier();
  discordpp::AuthorizationArgs args;
  args.SetClientId(kApplicationId);
  args.SetScopes(discordpp::Client::GetDefaultPresenceScopes());
  args.SetCodeChallenge(verifier.Challenge());
  client->Authorize(
    std::move(args),
    [verifierText](discordpp::ClientResult authResult,
                   std::string code,
                   std::string redirectUri) {
      if (!authResult.Successful()) {
        setState("auth_error", authResult.Error());
        return;
      }
      setState("exchanging_token");
      client->GetToken(
        kApplicationId, code, verifierText, redirectUri,
        [](discordpp::ClientResult tokenResult,
           std::string accessToken,
           std::string,
           discordpp::AuthorizationTokenType tokenType,
           int32_t,
           std::string) {
          if (!tokenResult.Successful()) {
            setState("auth_error", tokenResult.Error());
            return;
          }
          client->UpdateToken(
            tokenType, std::move(accessToken),
            [](discordpp::ClientResult updateResult) {
              if (!updateResult.Successful()) {
                setState("auth_error", updateResult.Error());
                return;
              }
              setState("connecting");
              client->Connect();
            });
        });
    });
  return true;
}

extern "C" void uf_discord_social_disconnect() {
  std::lock_guard<std::mutex> lock(clientMutex);
  if (client && client->IsAuthenticated()) client->Disconnect();
  setState("available");
}

extern "C" size_t uf_discord_social_snapshot(char* output, size_t capacity) {
  std::string currentPhase;
  std::string currentError;
  std::string currentDetectedName;
  {
    std::lock_guard<std::mutex> lock(stateMutex);
    currentPhase = phase;
    currentError = errorMessage;
    currentDetectedName = detectedName;
  }

  std::ostringstream json;
  json << "{\"available\":" << (client ? "true" : "false")
       << ",\"phase\":\"" << escapeJson(currentPhase) << "\""
       << ",\"error\":\"" << escapeJson(currentError) << "\""
       << ",\"detectedName\":\"" << escapeJson(currentDetectedName) << "\""
       << ",\"authenticated\":false,\"user\":null,\"friends\":[";

  if (client) {
    std::lock_guard<std::mutex> lock(clientMutex);
    const bool authenticated = client->IsAuthenticated();
    auto currentUser = client->GetCurrentUserV2();
    std::ostringstream body;
    body << "{\"available\":true,\"phase\":\"" << escapeJson(currentPhase) << "\""
         << ",\"error\":\"" << escapeJson(currentError) << "\""
         << ",\"detectedName\":\"" << escapeJson(currentDetectedName) << "\""
         << ",\"authenticated\":" << (authenticated ? "true" : "false") << ",\"user\":";
    if (currentUser) {
      body << "{\"id\":\"" << currentUser->Id() << "\",\"username\":\""
           << escapeJson(currentUser->Username()) << "\",\"displayName\":\""
           << escapeJson(currentUser->DisplayName()) << "\",\"avatarUrl\":\""
           << escapeJson(currentUser->AvatarUrl(discordpp::UserHandle::AvatarType::Gif,
                                                discordpp::UserHandle::AvatarType::Webp)) << "\"}";
    } else body << "null";
    body << ",\"friends\":[";
    bool first = true;
    if (currentPhase == "ready") {
      for (auto& relationship : client->GetRelationships()) {
        auto user = relationship.User();
        if (!user) continue;
        if (!first) body << ',';
        first = false;
        const auto gameActivity = user->GameActivity();
        const bool playingUltrafoot = gameActivity &&
          gameActivity->ApplicationId().has_value() &&
          gameActivity->ApplicationId().value() == kApplicationId;
        body << "{\"id\":\"" << user->Id() << "\",\"username\":\""
             << escapeJson(user->Username()) << "\",\"displayName\":\""
             << escapeJson(user->DisplayName()) << "\",\"avatarUrl\":\""
             << escapeJson(user->AvatarUrl(discordpp::UserHandle::AvatarType::Gif,
                                           discordpp::UserHandle::AvatarType::Webp))
             << "\",\"status\":\"" << statusName(user->Status())
             << "\",\"playingUltrafoot\":" << (playingUltrafoot ? "true" : "false") << '}';
      }
    }
    body << "]}";
    json.str("");
    json.clear();
    json << body.str();
  } else {
    json << "]}";
  }

  const std::string value = json.str();
  const size_t needed = value.size() + 1;
  if (output && capacity) {
    const size_t count = std::min(value.size(), capacity - 1);
    std::memcpy(output, value.data(), count);
    output[count] = '\0';
  }
  return needed;
}
