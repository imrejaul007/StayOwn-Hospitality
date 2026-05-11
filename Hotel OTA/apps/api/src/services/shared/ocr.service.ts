/**
 * Basic OCR Service for Stay Registration Verification.
 * Phase 1: Uses string matching heuristics.
 * Phase 2: Integrate Tesseract.js or AWS Textract.
 *
 * Extracts hotel name, date, and amount from receipt images.
 * Returns confidence score — below 0.6 flags for manual review.
 */
export class OCRService {
  /**
   * Extract stay data from receipt text (placeholder for real OCR).
   * In production, this would process an image buffer through Tesseract.
   * For now, it validates the metadata submitted by the user.
   */
  static async extractStayData(params: {
    hotelNameClaimed: string;
    stayDateClaimed: string;
    receiptImageUrl: string;
  }): Promise<{
    hotelNameDetected: string | null;
    dateDetected: string | null;
    amountDetected: number | null;
    confidenceScore: number;
    requiresManualReview: boolean;
  }> {
    // Phase 1: Simple validation heuristics
    // In production, replace with actual OCR processing

    let confidence = 0.3; // Base confidence without OCR

    // Validate hotel name is not empty and reasonable
    if (params.hotelNameClaimed && params.hotelNameClaimed.length > 3) {
      confidence += 0.2;
    }

    // Validate date is reasonable (not future, not too old)
    const stayDate = new Date(params.stayDateClaimed);
    const now = new Date();
    const daysDiff = (now.getTime() - stayDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff >= 0 && daysDiff <= 30) {
      confidence += 0.2; // Recent stay
    } else if (daysDiff > 30 && daysDiff <= 90) {
      confidence += 0.1; // Older stay, slightly less confidence
    }

    // Validate receipt URL exists
    if (params.receiptImageUrl && params.receiptImageUrl.startsWith('http')) {
      confidence += 0.1;
    }

    const requiresManualReview = confidence < 0.6;

    return {
      hotelNameDetected: params.hotelNameClaimed, // Placeholder
      dateDetected: params.stayDateClaimed,
      amountDetected: null, // Can't extract without real OCR
      confidenceScore: Math.min(confidence, 1.0),
      requiresManualReview,
    };
  }

  /**
   * Full OCR processing with Tesseract.js (Phase 2).
   * Uncomment and install tesseract.js when ready.
   */
  /*
  static async processImage(imageBuffer: Buffer): Promise<string> {
    const Tesseract = require('tesseract.js');
    const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng');
    return text;
  }

  static extractHotelName(ocrText: string, knownHotels: string[]): { name: string | null; confidence: number } {
    const textLower = ocrText.toLowerCase();
    for (const hotel of knownHotels) {
      if (textLower.includes(hotel.toLowerCase())) {
        return { name: hotel, confidence: 0.9 };
      }
    }
    // Fuzzy match could go here
    return { name: null, confidence: 0.1 };
  }

  static extractDate(ocrText: string): { date: string | null; confidence: number } {
    // Match common date formats
    const patterns = [
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
      /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i,
    ];
    for (const pattern of patterns) {
      const match = ocrText.match(pattern);
      if (match) return { date: match[0], confidence: 0.7 };
    }
    return { date: null, confidence: 0.1 };
  }

  static extractAmount(ocrText: string): { amount: number | null; confidence: number } {
    const match = ocrText.match(/(?:Rs\.?|₹|INR)\s*([\d,]+(?:\.\d{2})?)/i);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      return { amount: Math.round(amount * 100), confidence: 0.7 }; // paise
    }
    return { amount: null, confidence: 0.1 };
  }
  */
}
