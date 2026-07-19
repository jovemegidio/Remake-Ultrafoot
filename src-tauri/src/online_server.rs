use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    io::Read,
    net::{TcpListener, UdpSocket},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tiny_http::{Header, Method, Response, Server, StatusCode};

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OnlineParticipant {
    pub id: String,
    pub manager_name: String,
    pub team_short: String,
    pub ready: bool,
    pub connected: bool,
    pub last_seen: u64,
    #[serde(skip_serializing)]
    pub token: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OnlineAction {
    pub sequence: u64,
    pub participant_id: String,
    pub action_type: String,
    pub payload: Value,
    pub created_at: u64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OnlineRoom {
    pub room_code: String,
    pub game_version: String,
    pub data_version: String,
    pub data_hash: String,
    pub max_players: u8,
    pub participants: Vec<OnlineParticipant>,
    pub actions: Vec<OnlineAction>,
    pub current_round: u32,
    pub created_at: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OnlineSessionInfo {
    pub address: String,
    pub participant_id: String,
    pub session_token: String,
    pub room: OnlineRoom,
}

struct RunningServer {
    stop: Arc<AtomicBool>,
    room: Arc<Mutex<OnlineRoom>>,
    address: String,
    host_participant_id: String,
    host_token: String,
}

#[derive(Default)]
pub struct OnlineServerManager(Mutex<Option<RunningServer>>);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct JoinRequest {
    room_code: String,
    manager_name: String,
    team_short: String,
    game_version: String,
    data_version: String,
    data_hash: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthRequest {
    room_code: String,
    participant_id: String,
    session_token: String,
    #[serde(default)]
    ready: bool,
    #[serde(default)]
    action_type: String,
    #[serde(default)]
    payload: Value,
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs()
}

fn short_secret(seed: &str) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in seed.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}", hash)
}

fn local_ip() -> String {
    UdpSocket::bind("0.0.0.0:0")
        .and_then(|socket| {
            socket.connect("1.1.1.1:80")?;
            socket.local_addr()
        })
        .map(|address| address.ip().to_string())
        .unwrap_or_else(|_| "127.0.0.1".into())
}

fn available_port(preferred: u16) -> Result<u16, String> {
    if preferred != 0 && TcpListener::bind(("0.0.0.0", preferred)).is_ok() {
        return Ok(preferred);
    }
    TcpListener::bind(("0.0.0.0", 0))
        .and_then(|listener| listener.local_addr())
        .map(|address| address.port())
        .map_err(|error| format!("Nao foi possivel reservar uma porta LAN: {error}"))
}

fn json_response(value: Value, status: u16) -> Response<std::io::Cursor<Vec<u8>>> {
    let mut response = Response::from_data(serde_json::to_vec(&value).unwrap_or_else(|_| b"{}".to_vec()))
        .with_status_code(StatusCode(status));
    if let Ok(header) = Header::from_bytes("Content-Type", "application/json; charset=utf-8") {
        response.add_header(header);
    }
    if let Ok(header) = Header::from_bytes("Access-Control-Allow-Origin", "*") {
        response.add_header(header);
    }
    response
}

fn room_snapshot(room: &Arc<Mutex<OnlineRoom>>) -> Value {
    room.lock().map(|value| json!({"ok": true, "room": &*value})).unwrap_or_else(|_| json!({"ok": false, "error": "room_lock"}))
}

fn parse_body(request: &mut tiny_http::Request) -> Result<Value, String> {
    let mut body = String::new();
    request.as_reader().take(256 * 1024).read_to_string(&mut body).map_err(|error| error.to_string())?;
    serde_json::from_str(&body).map_err(|_| "JSON invalido".into())
}

fn authenticated_participant<'a>(room: &'a mut OnlineRoom, auth: &AuthRequest) -> Result<&'a mut OnlineParticipant, String> {
    if room.room_code != auth.room_code { return Err("Codigo da sala invalido".into()); }
    let participant = room.participants.iter_mut().find(|item| item.id == auth.participant_id).ok_or("Participante nao encontrado")?;
    if participant.token != auth.session_token { return Err("Sessao expirada ou invalida".into()); }
    participant.last_seen = now();
    participant.connected = true;
    Ok(participant)
}

fn handle_request(mut request: tiny_http::Request, room: &Arc<Mutex<OnlineRoom>>) {
    if request.method() == &Method::Options {
        let _ = request.respond(json_response(json!({"ok": true}), 204));
        return;
    }
    let request_url = request.url().to_string();
    let path = request_url.split('?').next().unwrap_or("/");
    let result = match (request.method(), path) {
        (&Method::Get, "/health") => json!({"ok": true}),
        (&Method::Get, "/data-manifest") => {
            let state = room.lock().unwrap();
            json!({"ok": true, "gameVersion": state.game_version, "dataVersion": state.data_version, "dataHash": state.data_hash})
        }
        (&Method::Get, "/room") => {
            let supplied = request_url.split_once("code=").map(|(_, value)| value.split('&').next().unwrap_or(""));
            let valid = room.lock().map(|state| supplied == Some(state.room_code.as_str())).unwrap_or(false);
            if valid { room_snapshot(room) } else { json!({"ok": false, "error": "Codigo da sala invalido"}) }
        },
        (&Method::Post, "/join") => match parse_body(&mut request).and_then(|body| serde_json::from_value::<JoinRequest>(body).map_err(|error| error.to_string())) {
            Ok(join) => {
                let mut state = room.lock().unwrap();
                if state.room_code != join.room_code { json!({"ok": false, "error": "Codigo da sala invalido"}) }
                else if state.game_version != join.game_version { json!({"ok": false, "error": "Versao do jogo diferente", "requiredVersion": state.game_version}) }
                else if state.data_version != join.data_version || state.data_hash != join.data_hash { json!({"ok": false, "error": "Banco de dados ou regulamentos divergentes", "requiredDataVersion": state.data_version, "requiredDataHash": state.data_hash}) }
                else if state.participants.len() >= usize::from(state.max_players) { json!({"ok": false, "error": "Sala lotada"}) }
                else {
                    let nonce = format!("{}:{}:{}:{}", join.manager_name, join.team_short, now(), state.participants.len());
                    let id = format!("p-{}", &short_secret(&nonce)[..8]);
                    let token = short_secret(&format!("token:{nonce}:{}", state.room_code));
                    state.participants.push(OnlineParticipant { id: id.clone(), manager_name: join.manager_name, team_short: join.team_short, ready: false, connected: true, last_seen: now(), token: token.clone() });
                    json!({"ok": true, "participantId": id, "sessionToken": token, "room": &*state})
                }
            }
            Err(error) => json!({"ok": false, "error": error}),
        },
        (&Method::Post, "/ready") => match parse_body(&mut request).and_then(|body| serde_json::from_value::<AuthRequest>(body).map_err(|error| error.to_string())) {
            Ok(auth) => {
                let mut state = room.lock().unwrap();
                match authenticated_participant(&mut state, &auth) {
                    Ok(participant) => { participant.ready = auth.ready; json!({"ok": true, "room": &*state}) }
                    Err(error) => json!({"ok": false, "error": error}),
                }
            }
            Err(error) => json!({"ok": false, "error": error}),
        },
        (&Method::Post, "/action") => match parse_body(&mut request).and_then(|body| serde_json::from_value::<AuthRequest>(body).map_err(|error| error.to_string())) {
            Ok(auth) => {
                let mut state = room.lock().unwrap();
                match authenticated_participant(&mut state, &auth).map(|participant| participant.id.clone()) {
                    Ok(participant_id) if !auth.action_type.is_empty() => {
                        if auth.action_type == "advance_round" {
                            if participant_id != "host" {
                                let value = json!({"ok": false, "error": "Somente o host pode avancar a rodada"});
                                let _ = request.respond(json_response(value, 403));
                                return;
                            }
                            if !state.participants.iter().all(|participant| participant.ready) {
                                let value = json!({"ok": false, "error": "Todos os tecnicos precisam confirmar a rodada"});
                                let _ = request.respond(json_response(value, 409));
                                return;
                            }
                            state.current_round += 1;
                            state.participants.iter_mut().for_each(|participant| participant.ready = false);
                        }
                        let sequence = state.actions.last().map_or(1, |action| action.sequence + 1);
                        state.actions.push(OnlineAction { sequence, participant_id, action_type: auth.action_type, payload: auth.payload, created_at: now() });
                        if state.actions.len() > 1000 { state.actions.drain(0..250); }
                        json!({"ok": true, "sequence": sequence, "room": &*state})
                    }
                    Ok(_) => json!({"ok": false, "error": "Tipo de acao ausente"}),
                    Err(error) => json!({"ok": false, "error": error}),
                }
            }
            Err(error) => json!({"ok": false, "error": error}),
        },
        _ => json!({"ok": false, "error": "Rota inexistente"}),
    };
    let status = if result.get("ok").and_then(Value::as_bool).unwrap_or(false) { 200 } else { 400 };
    let _ = request.respond(json_response(result, status));
}

fn remote_json(method: &str, address: &str, path: &str, body: Option<Value>) -> Result<Value, String> {
    let base = if address.starts_with("http://") || address.starts_with("https://") { address.trim_end_matches('/').to_string() } else { format!("http://{}", address.trim_end_matches('/')) };
    let url = format!("{base}{path}");
    let response = if method == "GET" { ureq::get(&url).timeout(Duration::from_secs(5)).call() } else { ureq::post(&url).timeout(Duration::from_secs(5)).send_json(body.unwrap_or_else(|| json!({}))) };
    match response {
        Ok(value) => value.into_json::<Value>().map_err(|error| error.to_string()),
        Err(ureq::Error::Status(_, value)) => value.into_json::<Value>().map_err(|error| error.to_string()),
        Err(error) => Err(format!("Servidor indisponivel: {error}")),
    }
}

#[tauri::command]
pub fn online_start_server(manager: tauri::State<OnlineServerManager>, host_name: String, host_team: String, game_version: String, data_version: String, data_hash: String, max_players: u8, preferred_port: Option<u16>) -> Result<OnlineSessionInfo, String> {
    online_stop_server(manager.clone());
    let port = available_port(preferred_port.unwrap_or(27960))?;
    let server = Server::http(("0.0.0.0", port)).map_err(|error| error.to_string())?;
    let created_at = now();
    let room_code = short_secret(&format!("{host_name}:{host_team}:{created_at}:{port}"))[..6].to_uppercase();
    let host_participant_id = "host".to_string();
    let host_token = short_secret(&format!("host:{room_code}:{created_at}"));
    let room = Arc::new(Mutex::new(OnlineRoom { room_code, game_version, data_version, data_hash, max_players: max_players.clamp(2, 16), participants: vec![OnlineParticipant { id: host_participant_id.clone(), manager_name: host_name, team_short: host_team, ready: false, connected: true, last_seen: created_at, token: host_token.clone() }], actions: vec![], current_round: 0, created_at }));
    let stop = Arc::new(AtomicBool::new(false));
    let server_room = room.clone();
    let server_stop = stop.clone();
    thread::spawn(move || {
        while !server_stop.load(Ordering::Relaxed) {
            if let Ok(Some(request)) = server.recv_timeout(Duration::from_millis(200)) { handle_request(request, &server_room); }
        }
    });
    let address = format!("{}:{port}", local_ip());
    let snapshot = room.lock().unwrap().clone();
    *manager.0.lock().unwrap() = Some(RunningServer { stop, room, address: address.clone(), host_participant_id: host_participant_id.clone(), host_token: host_token.clone() });
    Ok(OnlineSessionInfo { address, participant_id: host_participant_id, session_token: host_token, room: snapshot })
}

#[tauri::command]
pub fn online_stop_server(manager: tauri::State<OnlineServerManager>) -> bool {
    if let Some(server) = manager.0.lock().unwrap().take() { server.stop.store(true, Ordering::Relaxed); true } else { false }
}

#[tauri::command]
pub fn online_server_status(manager: tauri::State<OnlineServerManager>) -> Option<OnlineSessionInfo> {
    manager.0.lock().ok().and_then(|guard| guard.as_ref().map(|server| OnlineSessionInfo { address: server.address.clone(), participant_id: server.host_participant_id.clone(), session_token: server.host_token.clone(), room: server.room.lock().unwrap().clone() }))
}

#[tauri::command]
pub fn online_join_server(address: String, room_code: String, manager_name: String, team_short: String, game_version: String, data_version: String, data_hash: String) -> Result<Value, String> {
    remote_json("POST", &address, "/join", Some(json!({"roomCode": room_code, "managerName": manager_name, "teamShort": team_short, "gameVersion": game_version, "dataVersion": data_version, "dataHash": data_hash})))
}

#[tauri::command]
pub fn online_room_snapshot(address: String, room_code: String) -> Result<Value, String> {
    remote_json("GET", &address, &format!("/room?code={room_code}"), None)
}

#[tauri::command]
pub fn online_set_ready(address: String, room_code: String, participant_id: String, session_token: String, ready: bool) -> Result<Value, String> {
    remote_json("POST", &address, "/ready", Some(json!({"roomCode": room_code, "participantId": participant_id, "sessionToken": session_token, "ready": ready})))
}

#[tauri::command]
pub fn online_submit_action(address: String, room_code: String, participant_id: String, session_token: String, action_type: String, payload: Value) -> Result<Value, String> {
    remote_json("POST", &address, "/action", Some(json!({"roomCode": room_code, "participantId": participant_id, "sessionToken": session_token, "actionType": action_type, "payload": payload})))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lan_room_rejects_mismatched_data_and_accepts_compatible_player() {
        let port = available_port(0).unwrap();
        let server = Server::http(("127.0.0.1", port)).unwrap();
        let room = Arc::new(Mutex::new(OnlineRoom {
            room_code: "ABC123".into(), game_version: "1.0.80".into(), data_version: "2026.07.18".into(), data_hash: "hash-ok".into(), max_players: 4,
            participants: vec![OnlineParticipant { id: "host".into(), manager_name: "Host".into(), team_short: "FLA".into(), ready: false, connected: true, last_seen: now(), token: "host-token".into() }],
            actions: vec![], current_round: 0, created_at: now(),
        }));
        let stop = Arc::new(AtomicBool::new(false));
        let worker_room = room.clone();
        let worker_stop = stop.clone();
        let worker = thread::spawn(move || while !worker_stop.load(Ordering::Relaxed) {
            if let Ok(Some(request)) = server.recv_timeout(Duration::from_millis(50)) { handle_request(request, &worker_room); }
        });
        let address = format!("127.0.0.1:{port}");
        assert_eq!(remote_json("GET", &address, "/room", None).unwrap()["ok"], false);
        assert_eq!(remote_json("GET", &address, "/room?code=ABC123", None).unwrap()["ok"], true);
        let mismatch = remote_json("POST", &address, "/join", Some(json!({"roomCode":"ABC123","managerName":"Convidado","teamShort":"PAL","gameVersion":"1.0.80","dataVersion":"2026.07.18","dataHash":"outro"}))).unwrap();
        assert_eq!(mismatch["ok"], false);
        let joined = remote_json("POST", &address, "/join", Some(json!({"roomCode":"ABC123","managerName":"Convidado","teamShort":"PAL","gameVersion":"1.0.80","dataVersion":"2026.07.18","dataHash":"hash-ok"}))).unwrap();
        assert_eq!(joined["ok"], true);
        assert_eq!(joined["room"]["participants"].as_array().unwrap().len(), 2);
        stop.store(true, Ordering::Relaxed);
        worker.join().unwrap();
    }
}
