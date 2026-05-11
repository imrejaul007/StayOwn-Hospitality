import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getSerialInfo } from '@/lib/serial/validator'

export async function GET(
  request: NextRequest,
  { params }: { params: { serial: string } }
) {
  try {
    const result = await getSerialInfo(params.serial)

    if (!result.valid) {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('Get serial error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
