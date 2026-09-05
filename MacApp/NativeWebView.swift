import Foundation
import AppKit
import SwiftUI
import WebKit

fileprivate final class ResourceSchemeHandler: NSObject, WKURLSchemeHandler {
    private let rootURL: URL

    init(rootURL: URL) {
        self.rootURL = rootURL.standardizedFileURL
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let requestURL = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(NSError(domain: "ResearchReader", code: 1, userInfo: [NSLocalizedDescriptionKey: "Missing resource URL"]))
            return
        }
        let relativePath = requestURL.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let fileURL = rootURL.appendingPathComponent(relativePath).standardizedFileURL
        guard fileURL.path.hasPrefix(rootURL.path + "/"), let data = try? Data(contentsOf: fileURL) else {
            urlSchemeTask.didFailWithError(NSError(domain: "ResearchReader", code: 2, userInfo: [NSLocalizedDescriptionKey: "Resource not found: \(relativePath)"]))
            return
        }
        let response = URLResponse(
            url: requestURL,
            mimeType: mimeType(for: fileURL.pathExtension),
            expectedContentLength: data.count,
            textEncodingName: textEncoding(for: fileURL.pathExtension)
        )
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // Resources are read synchronously and finish in the same callback.
    }

    private func mimeType(for extensionName: String) -> String {
        switch extensionName.lowercased() {
        case "html": return "text/html"
        case "css": return "text/css"
        case "js", "mjs": return "text/javascript"
        case "json": return "application/json"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "woff": return "font/woff"
        case "woff2": return "font/woff2"
        default: return "application/octet-stream"
        }
    }

    private func textEncoding(for extensionName: String) -> String? {
        ["html", "css", "js", "mjs", "json"].contains(extensionName.lowercased()) ? "utf-8" : nil
    }
}

struct NativeWebView: NSViewRepresentable {
    let appDelegate: AppDelegate

    func makeCoordinator() -> Coordinator {
        Coordinator(appDelegate: appDelegate)
    }

    func makeNSView(context: Context) -> WKWebView {
        guard let resourceRoot = Bundle.module.url(forResource: "web", withExtension: nil) else {
            let webView = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
            showMissingResourcesAlert()
            return webView
        }
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.userContentController.add(context.coordinator, name: "openPDF")
        configuration.userContentController.add(context.coordinator, name: "openExternal")
        configuration.userContentController.add(context.coordinator, name: "copyText")
        let schemeHandler = ResourceSchemeHandler(rootURL: resourceRoot)
        context.coordinator.schemeHandler = schemeHandler
        configuration.setURLSchemeHandler(schemeHandler, forURLScheme: "research-reader")
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        appDelegate.connect(webView: webView)

        guard let indexURL = URL(string: "research-reader://app/index.html") else { return webView }
        webView.load(URLRequest(url: indexURL))
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        // The React application owns its state and navigation after the initial load.
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        let appDelegate: AppDelegate
        fileprivate var schemeHandler: ResourceSchemeHandler?

        init(appDelegate: AppDelegate) {
            self.appDelegate = appDelegate
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            appDelegate.webViewDidFinishLoading(webView)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            NSLog("ResearchReader: web content failed to load: %@", error.localizedDescription)
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            switch message.name {
            case "openPDF":
                appDelegate.openPDFPanel()
            case "openExternal":
                guard let body = message.body as? [String: Any], let urlString = body["url"] as? String, let url = URL(string: urlString) else { return }
                NSWorkspace.shared.open(url)
            case "copyText":
                guard let text = message.body as? String else { return }
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(text, forType: .string)
            default:
                return
            }
        }
    }

    private func showMissingResourcesAlert() {
        let alert = NSAlert()
        alert.messageText = "Research Reader resources are missing"
        alert.informativeText = "Run script/build_and_run.sh to build the React resources before launching the macOS app."
        alert.alertStyle = .warning
        alert.runModal()
    }
}
