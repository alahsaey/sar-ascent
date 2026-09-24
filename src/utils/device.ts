/**
 * Client Device, Browser, and Platform Detection Utility
 * Extracts rich, accurate device information from user-agent string for forensic auditing.
 */

export interface ClientDeviceInfo {
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  deviceLabelAr: string;       // e.g. "كمبيوتر مكتبي" | "هاتف ذكي" | "جهاز لوحي"
  browserName: string;         // e.g. "Chrome" | "Safari" | "Edge" | "Firefox" | "Samsung Internet"
  browserVersion: string;      // e.g. "128.0"
  osName: string;              // e.g. "Windows 11" | "iOS" | "Android" | "macOS"
  fullUserAgent: string;
  summaryLabelAr: string;      // e.g. "كمبيوتر (Windows) - Chrome"
}

export function parseUserAgentString(uaInput?: string): ClientDeviceInfo {
  const ua = uaInput || (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '';

  let browserName = 'متصفح ويب';
  let browserVersion = '';
  let osName = 'غير محدد';
  let deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown' = 'desktop';

  if (!ua) {
    return {
      deviceType: 'unknown',
      deviceLabelAr: 'غير محدد',
      browserName: 'مجهول',
      browserVersion: '',
      osName: 'غير محدد',
      fullUserAgent: 'Unknown',
      summaryLabelAr: 'جهاز غير معروف'
    };
  }

  // 1. Detect Operating System
  if (/windows phone/i.test(ua)) {
    osName = 'Windows Phone';
    deviceType = 'mobile';
  } else if (/win/i.test(ua)) {
    if (/windows nt 10\.0/i.test(ua)) osName = 'Windows 10/11';
    else if (/windows nt 6\.3/i.test(ua)) osName = 'Windows 8.1';
    else if (/windows nt 6\.2/i.test(ua)) osName = 'Windows 8';
    else if (/windows nt 6\.1/i.test(ua)) osName = 'Windows 7';
    else osName = 'Windows';
    deviceType = 'desktop';
  } else if (/iphone/i.test(ua)) {
    osName = 'iOS (iPhone)';
    deviceType = 'mobile';
  } else if (/ipad/i.test(ua) || (/macintosh/i.test(ua) && typeof navigator !== 'undefined' && (navigator as any).maxTouchPoints > 1)) {
    osName = 'iPadOS';
    deviceType = 'tablet';
  } else if (/mac/i.test(ua)) {
    osName = 'macOS';
    deviceType = 'desktop';
  } else if (/android/i.test(ua)) {
    osName = 'Android';
    deviceType = /mobile/i.test(ua) ? 'mobile' : 'tablet';
  } else if (/linux/i.test(ua)) {
    osName = 'Linux';
    deviceType = 'desktop';
  }

  // 2. Detect Browser Name & Version
  if (/samsungbrowser\/([0-9.]+)/i.test(ua)) {
    browserName = 'Samsung Internet';
    browserVersion = RegExp.$1;
  } else if (/edg\/([0-9.]+)/i.test(ua) || /edge\/([0-9.]+)/i.test(ua)) {
    browserName = 'Microsoft Edge';
    browserVersion = RegExp.$1;
  } else if (/opr\/([0-9.]+)/i.test(ua) || /opera/i.test(ua)) {
    browserName = 'Opera';
    browserVersion = RegExp.$1;
  } else if (/chrome\/([0-9.]+)/i.test(ua) || /crios\/([0-9.]+)/i.test(ua)) {
    browserName = 'Google Chrome';
    browserVersion = RegExp.$1;
  } else if (/firefox\/([0-9.]+)/i.test(ua) || /fxios\/([0-9.]+)/i.test(ua)) {
    browserName = 'Mozilla Firefox';
    browserVersion = RegExp.$1;
  } else if (/version\/([0-9.]+).*safari/i.test(ua)) {
    browserName = 'Apple Safari';
    browserVersion = RegExp.$1;
  }

  // 3. Format Arabic device label
  let deviceLabelAr = 'كمبيوتر مكتبي';
  if (deviceType === 'mobile') {
    deviceLabelAr = 'هاتف ذكي';
  } else if (deviceType === 'tablet') {
    deviceLabelAr = 'جهاز لوحي';
  }

  // Short clean summary: "هاتف ذكي (iPhone) - Safari" or "كمبيوتر (Windows) - Chrome"
  const summaryLabelAr = `${deviceLabelAr} (${osName}) - ${browserName}`;

  return {
    deviceType,
    deviceLabelAr,
    browserName,
    browserVersion,
    osName,
    fullUserAgent: ua,
    summaryLabelAr
  };
}

/**
 * Detects current runtime client environment
 */
export function detectClientEnvironment(): ClientDeviceInfo {
  if (typeof navigator === 'undefined') {
    return {
      deviceType: 'unknown',
      deviceLabelAr: 'خادم / نظام آلي',
      browserName: 'Server Engine',
      browserVersion: '',
      osName: 'Cloud Server',
      fullUserAgent: 'Node/Server',
      summaryLabelAr: 'محرك آلي'
    };
  }

  return parseUserAgentString(navigator.userAgent);
}
