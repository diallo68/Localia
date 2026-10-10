// Aide de Localia pour le modèle intégré d'Apple (framework Foundation Models, macOS 26 et plus,
// Mac Apple Silicon avec Apple Intelligence activé). Lit une demande JSON sur l'entrée standard,
// répond par des lignes JSON sur la sortie standard :
//   {"action":"status"}  → {"type":"status","available":true}
//                          ou {"type":"status","available":false,"reason":"…"}
//   {"action":"chat","instructions":"…","prompt":"…","temperature":0.6,"maxTokens":2048}
//                        → {"type":"delta","text":"…"}… puis {"type":"done"} ou {"type":"error",…}
// Compilé pour macOS 14 et plus : le framework est lié faiblement, et sur un système plus ancien
// ou un Mac Intel, l'aide répond simplement « indisponible ».
import Foundation

#if canImport(FoundationModels)
  import FoundationModels
#endif

struct Request: Decodable {
  let action: String
  let instructions: String?
  let prompt: String?
  let temperature: Double?
  let maxTokens: Int?
}

func emit(_ object: [String: Any]) {
  guard let data = try? JSONSerialization.data(withJSONObject: object),
    let line = String(data: data, encoding: .utf8)
  else { return }
  FileHandle.standardOutput.write((line + "\n").data(using: .utf8)!)
}

func readRequest() -> Request? {
  let data = FileHandle.standardInput.readDataToEndOfFile()
  return try? JSONDecoder().decode(Request.self, from: data)
}

#if canImport(FoundationModels)
  @available(macOS 26.0, *)
  func unavailableReason() -> String? {
    switch SystemLanguageModel.default.availability {
    case .available:
      return nil
    case .unavailable(.deviceNotEligible):
      return "deviceNotEligible"
    case .unavailable(.appleIntelligenceNotEnabled):
      return "appleIntelligenceNotEnabled"
    case .unavailable(.modelNotReady):
      return "modelNotReady"
    case .unavailable:
      return "unavailable"
    }
  }

  @available(macOS 26.0, *)
  func errorCode(_ error: Error) -> String {
    guard let generation = error as? LanguageModelSession.GenerationError else { return "other" }
    switch generation {
    case .exceededContextWindowSize: return "exceededContextWindowSize"
    case .guardrailViolation: return "guardrailViolation"
    case .unsupportedLanguageOrLocale: return "unsupportedLanguageOrLocale"
    case .assetsUnavailable: return "assetsUnavailable"
    case .rateLimited: return "rateLimited"
    case .concurrentRequests: return "concurrentRequests"
    case .refusal: return "refusal"
    default: return "other"
    }
  }

  @available(macOS 26.0, *)
  func chat(_ request: Request) async {
    if let reason = unavailableReason() {
      emit(["type": "error", "code": reason, "message": reason])
      return
    }
    let session = LanguageModelSession(instructions: request.instructions)
    let options = GenerationOptions(
      temperature: request.temperature, maximumResponseTokens: request.maxTokens)
    var sent = ""
    do {
      // Chaque instantané contient tout le texte écrit jusque-là : seule la suite est envoyée.
      for try await snapshot in session.streamResponse(to: request.prompt ?? "", options: options) {
        let text = snapshot.content
        if text.hasPrefix(sent) {
          let delta = String(text.dropFirst(sent.count))
          if !delta.isEmpty { emit(["type": "delta", "text": delta]) }
        } else {
          emit(["type": "replace", "text": text])
        }
        sent = text
      }
      emit(["type": "done"])
    } catch {
      emit(["type": "error", "code": errorCode(error), "message": String(describing: error)])
    }
  }
#endif

func run() async {
  guard let request = readRequest() else {
    emit(["type": "error", "code": "badRequest", "message": "Demande illisible."])
    return
  }
  #if canImport(FoundationModels)
    if #available(macOS 26.0, *) {
      if request.action == "status" {
        if let reason = unavailableReason() {
          emit(["type": "status", "available": false, "reason": reason])
        } else {
          emit(["type": "status", "available": true])
        }
      } else {
        await chat(request)
      }
      return
    }
  #endif
  let reason = "osTooOld"
  if request.action == "status" {
    emit(["type": "status", "available": false, "reason": reason])
  } else {
    emit(["type": "error", "code": reason, "message": reason])
  }
}

await run()
