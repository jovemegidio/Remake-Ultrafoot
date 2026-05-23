import { generateText } from "ai"

export async function POST(req: Request) {
  try {
    const { newsType, title, teamName, playerName } = await req.json()

    // Gera um prompt baseado no tipo de noticia
    const prompt = generatePrompt(newsType, title, teamName, playerName)

    // Usa o modelo multi-modal Nano Banana 2 para gerar imagem
    const result = await generateText({
      model: "google/gemini-3.1-flash-image-preview",
      prompt: `Generate a professional sports journalism image for the following news:

${prompt}

Style: Modern sports photography, dynamic, professional, high quality, cinematic lighting.
Important: The image should NOT contain any text or logos. Focus on the visual atmosphere and emotion.`,
    })

    // Extrai a URL da imagem gerada
    const imageUrl = extractImageUrl(result)

    return Response.json({ 
      imageUrl,
      prompt: prompt 
    })
  } catch (error) {
    console.error("Error generating news image:", error)
    return Response.json(
      { error: "Failed to generate image" },
      { status: 500 }
    )
  }
}

function generatePrompt(newsType: string, title: string, teamName?: string, playerName?: string): string {
  const basePrompts: Record<string, string> = {
    transfer: `A football player in professional attire signing a contract at a modern stadium press room, with club officials shaking hands. ${teamName ? `The scene suggests a big transfer to ${teamName}.` : ""} ${playerName ? `Focus on a young talented player.` : ""}`,
    
    injury: `A concerned football player being attended by medical staff on a professional football pitch. ${playerName ? "The player is being helped to walk off the field." : ""} Dramatic lighting, showing the tension of the moment.`,
    
    highlight: `A football team celebrating together after a victory, confetti in the air, fans cheering in the background. ${teamName ? `Team colors and atmosphere of ${teamName} supporters.` : ""} Stadium lights, euphoric atmosphere.`,
    
    ranking: `A football stadium scoreboard showing top scorers statistics, with a golden boot trophy in the foreground. Modern LED display, professional broadcast quality.`,
    
    announcement: `A modern football club press conference room with microphones and cameras, club badges visible. Professional journalism setting.`,
    
    match_preview: `An epic aerial view of a Brazilian football stadium at night, packed with fans, green pitch illuminated by floodlights. Dramatic pre-match atmosphere.`,
    
    crisis: `A football stadium with empty stands, security barriers, tension in the air. Dark moody atmosphere suggesting club crisis.`,
    
    youth: `A young football talent (18-20 years old) training alone on a professional pitch, focused and determined. Dawn light, inspiring atmosphere of a rising star.`,
    
    tactical: `A football manager analyzing tactics on a digital tactical board, pointing at formations. Modern training facility, professional coaching atmosphere.`,
    
    financial: `A modern football club boardroom with financial charts on screens, executives in meeting. Professional corporate football business environment.`,
  }

  return basePrompts[newsType] || basePrompts.announcement
}

function extractImageUrl(result: Awaited<ReturnType<typeof generateText>>): string | null {
  // O resultado pode conter imagens embutidas ou referencias
  // Verifica se ha partes de imagem no resultado
  if (result.response?.messages) {
    for (const msg of result.response.messages) {
      if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((part as any).type === "image" && "image" in part) {
            const imgPart = part as unknown as { type: "image"; image: Uint8Array | URL | string; mimeType?: string }
            // Se for URL, retorna diretamente
            if (typeof imgPart.image === "string") {
              return imgPart.image
            }
            // Se for Uint8Array, converte para base64
            if (imgPart.image instanceof Uint8Array) {
              const base64 = Buffer.from(imgPart.image).toString("base64")
              const mimeType = imgPart.mimeType || "image/png"
              return `data:${mimeType};base64,${base64}`
            }
          }
        }
      }
    }
  }
  
  return null
}
