'use server'

import { createClient } from '@/lib/supabase/server'
import QRCode from 'qrcode'

/**
 * Generate QR code PNG buffer and upload to Supabase Storage
 * Returns the public URL of the uploaded QR code
 */
export async function generateAndUploadQRCode(
  registrationId: string,
  qrCodeData: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const supabase = await createClient()

  try {
    // Generate QR code as PNG buffer
    const qrBuffer = await QRCode.toBuffer(qrCodeData, {
      errorCorrectionLevel: 'H',
      type: 'png',
      width: 400,
      margin: 2,
    })

    // Upload to Supabase Storage
    const fileName = `qr-codes/${registrationId}.png`
    
    const { data, error: uploadError } = await supabase.storage
      .from('public')
      .upload(fileName, qrBuffer, {
        contentType: 'image/png',
        upsert: true,
      })

    if (uploadError) {
      console.error('[QR Upload Error]', uploadError)
      return { success: false, error: uploadError.message }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('public')
      .getPublicUrl(fileName)

    const publicUrl = urlData.publicUrl

    // Update registration with QR code URL
    const { error: updateError } = await supabase
      .from('registrations')
      .update({ qr_code_url: publicUrl })
      .eq('id', registrationId)

    if (updateError) {
      console.error('[QR URL Update Error]', updateError)
    }

    console.log('[QR Code Generated]', { registrationId, url: publicUrl })
    return { success: true, url: publicUrl }

  } catch (error) {
    console.error('[QR Generation Error]', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Get QR code URL for a registration
 * If URL doesn't exist, generate and upload a new one
 */
export async function getOrCreateQRCodeUrl(
  registrationId: string,
  qrCodeData: string
): Promise<string | null> {
  const supabase = await createClient()

  // Check if QR code URL already exists
  const { data: registration } = await supabase
    .from('registrations')
    .select('qr_code_url')
    .eq('id', registrationId)
    .single()

  if (registration?.qr_code_url) {
    return registration.qr_code_url
  }

  // Generate and upload new QR code
  const result = await generateAndUploadQRCode(registrationId, qrCodeData)
  return result.url || null
}

/**
 * Generate QR code as a PNG Buffer
 * Useful for inline email attachments (CID)
 */
export async function generateQRCodeBuffer(qrCodeData: string): Promise<Buffer> {
  return await QRCode.toBuffer(qrCodeData, {
    errorCorrectionLevel: 'H',
    type: 'png',
    width: 400,
    margin: 2,
  })
}
