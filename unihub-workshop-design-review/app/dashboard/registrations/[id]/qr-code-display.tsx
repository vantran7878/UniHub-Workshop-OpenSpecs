'use client'

import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

interface QRCodeDisplayProps {
  qrCode: string
  workshopTitle: string
  userName: string
}

export function QRCodeDisplay({ qrCode, workshopTitle, userName }: QRCodeDisplayProps) {
  const downloadQRCode = () => {
    const svg = document.getElementById('qr-code-svg')
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx?.drawImage(img, 0, 0)
      const pngFile = canvas.toDataURL('image/png')
      
      const downloadLink = document.createElement('a')
      downloadLink.download = `QR-${workshopTitle.slice(0, 20)}.png`
      downloadLink.href = pngFile
      downloadLink.click()
    }
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }

  return (
    <div className="flex flex-col items-center space-y-4 p-6 rounded-lg bg-white">
      <QRCodeSVG
        id="qr-code-svg"
        value={qrCode}
        size={200}
        level="H"
        includeMargin
        bgColor="#ffffff"
        fgColor="#000000"
      />
      <div className="text-center">
        <p className="font-medium text-foreground">{userName}</p>
        <p className="text-sm text-muted-foreground">
          Quét mã này để check-in tại workshop
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={downloadQRCode}>
        <Download className="mr-2 h-4 w-4" />
        Tải mã QR
      </Button>
    </div>
  )
}
