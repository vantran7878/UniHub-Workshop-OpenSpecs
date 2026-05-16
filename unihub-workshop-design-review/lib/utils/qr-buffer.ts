import QRCode from 'qrcode'

/**
 * Generate QR code as a PNG Buffer.
 * This is NOT a server action – it's a plain utility so that
 * the returned Buffer is never serialized through the RSC wire format.
 */
export async function generateQRCodeBuffer(qrCodeData: string): Promise<Buffer> {
  return await QRCode.toBuffer(qrCodeData, {
    errorCorrectionLevel: 'L', // Lowest - creates simplest/smallest buffer
    type: 'png',
    width: 200,
    margin: 1,
  })
}
