export function normalizeWhatsAppPhone(phone?: string | null, defaultCountryCode = "55") {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length > 11) digits = digits.replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) digits = `${defaultCountryCode}${digits}`;
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export function buildWhatsAppLink(phone: string | undefined, message: string) {
  const number = normalizeWhatsAppPhone(phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
