import AppKit
import Foundation
import UniformTypeIdentifiers
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    private weak var webView: WKWebView?
    private var pendingURLs: [URL] = []
    private var webViewReady = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        if let iconURL = Bundle.main.url(forResource: "AppIcon", withExtension: "icns"),
           let icon = NSImage(contentsOf: iconURL) {
            NSApp.applicationIconImage = icon
        }
        NSApp.activate(ignoringOtherApps: true)
    }

    func connect(webView: WKWebView) {
        self.webView = webView
        webViewReady = false
    }

    func webViewDidFinishLoading(_ webView: WKWebView) {
        self.webView = webView
        webViewReady = true
        let urls = pendingURLs
        pendingURLs.removeAll()
        urls.forEach(sendPDF)
    }

    func openPDFPanel() {
        let panel = NSOpenPanel()
        panel.title = "Import PDF"
        panel.prompt = "Open"
        panel.allowedContentTypes = [.pdf]
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.begin { [weak self] response in
            guard response == .OK, let url = panel.url else { return }
            self?.sendPDF(url)
        }
    }

    func application(_ application: NSApplication, openFiles filenames: [String]) {
        filenames.map(URL.init(fileURLWithPath:)).forEach(queueOrSendPDF)
        NSApp.reply(toOpenOrPrint: .success)
    }

    @MainActor
    func application(_ application: NSApplication, open urls: [URL]) {
        urls.forEach(queueOrSendPDF)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    private func queueOrSendPDF(_ url: URL) {
        guard url.pathExtension.lowercased() == "pdf" else { return }
        guard webViewReady else {
            pendingURLs.append(url)
            return
        }
        sendPDF(url)
    }

    private func sendPDF(_ url: URL) {
        guard let webView else {
            pendingURLs.append(url)
            return
        }
        guard let data = try? Data(contentsOf: url) else {
            NSLog("ResearchReader: unable to read PDF at %@", url.path)
            return
        }
        let payload: [String: Any] = [
            "name": url.lastPathComponent,
            "base64": data.base64EncodedString(),
        ]
        guard let jsonData = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: jsonData, encoding: .utf8) else { return }
        let script = "window.dispatchEvent(new CustomEvent('research-reader-native-file',{detail:\(json)}));"
        webView.evaluateJavaScript(script) { _, error in
            if let error {
                NSLog("ResearchReader: failed to deliver PDF to web app: %@", error.localizedDescription)
            }
        }
    }
}
