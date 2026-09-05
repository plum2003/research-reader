import SwiftUI

struct ContentView: View {
    let appDelegate: AppDelegate

    var body: some View {
        NativeWebView(appDelegate: appDelegate)
            .frame(minWidth: 1080, minHeight: 700)
    }
}
