import AppKit
import Foundation

guard CommandLine.arguments.count == 2 else {
    fputs("usage: render_icon.swift <iconset-directory>\n", stderr)
    exit(2)
}

let outputDirectory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)

let sizes: [(CGFloat, String)] = [
    (16, "icon_16x16.png"),
    (32, "icon_16x16@2x.png"),
    (32, "icon_32x32.png"),
    (64, "icon_32x32@2x.png"),
    (128, "icon_128x128.png"),
    (256, "icon_128x128@2x.png"),
    (256, "icon_256x256.png"),
    (512, "icon_256x256@2x.png"),
    (512, "icon_512x512.png"),
    (1024, "icon_512x512@2x.png"),
]

func color(_ hex: UInt32) -> NSColor {
    NSColor(
        calibratedRed: CGFloat((hex >> 16) & 0xff) / 255,
        green: CGFloat((hex >> 8) & 0xff) / 255,
        blue: CGFloat(hex & 0xff) / 255,
        alpha: 1
    )
}

func drawIcon(size: CGFloat) -> Data? {
    guard let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: Int(size),
        pixelsHigh: Int(size),
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .calibratedRGB,
        bitmapFormat: [],
        bytesPerRow: 0,
        bitsPerPixel: 0
    ), let graphics = NSGraphicsContext(bitmapImageRep: bitmap) else { return nil }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = graphics
    defer { NSGraphicsContext.restoreGraphicsState() }

    let scale = size / 1024
    let context = graphics.cgContext
    context.saveGState()
    context.scaleBy(x: scale, y: scale)

    color(0x142A3A).setFill()
    NSBezierPath(roundedRect: NSRect(x: 64, y: 64, width: 896, height: 896), xRadius: 224, yRadius: 224).fill()

    let leftPage = NSBezierPath()
    leftPage.move(to: NSPoint(x: 160, y: 705))
    leftPage.curve(to: NSPoint(x: 492, y: 678), controlPoint1: NSPoint(x: 278, y: 758), controlPoint2: NSPoint(x: 393, y: 736))
    leftPage.line(to: NSPoint(x: 492, y: 271))
    leftPage.curve(to: NSPoint(x: 160, y: 291), controlPoint1: NSPoint(x: 374, y: 339), controlPoint2: NSPoint(x: 254, y: 342))
    leftPage.close()
    color(0xFFF7E8).setFill()
    leftPage.fill()

    let rightPage = NSBezierPath()
    rightPage.move(to: NSPoint(x: 532, y: 678))
    rightPage.curve(to: NSPoint(x: 864, y: 705), controlPoint1: NSPoint(x: 631, y: 736), controlPoint2: NSPoint(x: 746, y: 758))
    rightPage.line(to: NSPoint(x: 864, y: 291))
    rightPage.curve(to: NSPoint(x: 532, y: 271), controlPoint1: NSPoint(x: 770, y: 342), controlPoint2: NSPoint(x: 650, y: 339))
    rightPage.close()
    color(0xFF725C).setFill()
    rightPage.fill()

    color(0x45D7C9).setFill()
    NSBezierPath(roundedRect: NSRect(x: 492, y: 271, width: 72, height: 407), xRadius: 28, yRadius: 28).fill()

    color(0x142A3A).setStroke()
    context.setLineWidth(18)
    for y in [610, 520, 430] {
        let leftLine = NSBezierPath()
        leftLine.move(to: NSPoint(x: 210, y: CGFloat(y)))
        leftLine.curve(to: NSPoint(x: 440, y: CGFloat(y) - 8), controlPoint1: NSPoint(x: 286, y: CGFloat(y) + 18), controlPoint2: NSPoint(x: 367, y: CGFloat(y) + 12))
        leftLine.stroke()
        let rightLine = NSBezierPath()
        rightLine.move(to: NSPoint(x: 616, y: CGFloat(y) - 8))
        rightLine.curve(to: NSPoint(x: 814, y: CGFloat(y)), controlPoint1: NSPoint(x: 693, y: CGFloat(y) + 12), controlPoint2: NSPoint(x: 764, y: CGFloat(y) + 18))
        rightLine.stroke()
    }

    color(0xFFD166).setFill()
    NSBezierPath(ovalIn: NSRect(x: 736, y: 748, width: 108, height: 108)).fill()
    color(0x142A3A).setStroke()
    context.setLineWidth(18)
    let check = NSBezierPath()
    check.move(to: NSPoint(x: 765, y: 801))
    check.line(to: NSPoint(x: 785, y: 781))
    check.line(to: NSPoint(x: 820, y: 821))
    check.lineCapStyle = .round
    check.lineJoinStyle = .round
    check.stroke()

    context.restoreGState()
    return bitmap.representation(using: NSBitmapImageRep.FileType.png, properties: [:])
}

for (size, name) in sizes {
    guard let png = drawIcon(size: size) else { exit(1) }
    try png.write(to: outputDirectory.appendingPathComponent(name), options: .atomic)
}
