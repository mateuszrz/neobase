/**
 * Terms of Service + Privacy Policy content, as Markdown per locale, rendered by
 * the /terms and /privacy pages through <Markdown>.
 *
 * ⚠️ DRAFT — legal review required before this is binding. Every `[BRACKETED]`
 * token is a placeholder for a real value the operator must fill in (legal
 * entity, address, contact email, registration numbers). English + Polish are
 * authored here; other locales fall back to English until a reviewed
 * translation exists — machine-translating un-reviewed legal text isn't worth
 * the risk. Keep LEGAL_UPDATED in step with any substantive edit.
 */

import { routing } from "@/i18n/routing";

export type LegalKind = "terms" | "privacy";

export const LEGAL_UPDATED = "2026-07-23"; // ISO date of the last substantive change

// ── Fill these in one place; both documents reference them. ──────────────────
// Operator / data controller identity. The remaining bracketed values still
// need filling. NeoBase is run by a Polish sole proprietorship (CEIDG), so the
// registration descriptor is worded per language.
const OPERATOR = "The Clarity Mateusz Rzetecki";
const OPERATOR_REG_EN = "a sole proprietorship registered in the Polish Central Registration and Information on Business (CEIDG), NIP [NIP], REGON [REGON]";
const OPERATOR_REG_PL = "prowadzącego jednoosobową działalność gospodarczą wpisaną do CEIDG, NIP [NIP], REGON [REGON]";
const OPERATOR_ADDRESS = "[ADRES SIEDZIBY — ul. Przykładowa 1, 00-000 Miasto, Polska]";
const CONTACT_EMAIL = "[kontakt@neobase.co]";

const TERMS_EN = `# Terms of Service

_Last updated: ${LEGAL_UPDATED}_

## 1. Who we are

These Terms govern your use of **NeoBase** (the "Service"), operated by ${OPERATOR}, ${OPERATOR_REG_EN}, with its registered office at ${OPERATOR_ADDRESS} (the "Operator", "we", "us"). By using the Service you agree to these Terms; if you do not agree, please do not use the Service.

## 2. What the Service does

NeoBase aggregates **publicly available information** about neobanks and crypto-exchanges — ratings and review counts from third-party platforms (e.g. Trustpilot, Google Play, the App Store), public news, social and regulatory data — and combines it into our own composite indicators, including the **NeoBase Score**. We also offer optional accounts, competitive reports and paid monitoring.

## 3. Nature of the information — no advice

The Service is provided **for information purposes only**.

- The information is aggregated from third-party and public sources and **may be incomplete, delayed or inaccurate**. We do not warrant its accuracy or completeness.
- The **NeoBase Score is our own editorial indicator**, computed from the data described above. It is not an official rating and not endorsed by the brands it describes.
- Nothing on the Service is **investment, financial, legal or tax advice**, nor a recommendation to use, buy or sell any product or service. Decisions you make based on the Service are your own responsibility.

## 4. Accounts

Some features require an account. We use passwordless sign-in: you enter your email and receive a one-time sign-in link. You are responsible for keeping access to your email secure and for activity under your account. You may close your account at any time by contacting ${CONTACT_EMAIL}.

## 5. Paid services

Paid plans (e.g. monitoring, reports) — where offered — are described at the point of purchase, including price and billing period. Payments are handled by our payment provider; their terms apply to the transaction. Statutory withdrawal rights for consumers apply where required by law; details are provided at checkout.

## 6. Acceptable use

You agree not to: use the Service unlawfully; scrape, bulk-download or systematically extract data except through interfaces we provide; disrupt or probe the Service's security; misrepresent the NeoBase Score as an official rating; or infringe our or third parties' rights.

## 7. Intellectual property

The Service, its design, text, and the NeoBase Score methodology and outputs are protected by law. Underlying third-party ratings and marks belong to their respective owners. You may share and link to our pages for non-commercial purposes with attribution; any other use requires our consent.

## 8. Liability

To the fullest extent permitted by law, we are not liable for decisions made in reliance on the Service, for the accuracy of third-party data, or for indirect or consequential loss. Nothing here limits liability that cannot be limited by law (including for consumers).

## 9. Complaints

You can raise a complaint at ${CONTACT_EMAIL}. We aim to respond within 14 days.

## 10. Changes

We may update these Terms; the "last updated" date reflects the current version. Material changes affecting registered users will be communicated by email or in the Service.

## 11. Governing law

These Terms are governed by Polish law and applicable EU law, without prejudice to mandatory consumer-protection rules of your country of residence. Disputes are subject to the competent courts, subject to consumers' statutory rights.

## 12. Contact

${OPERATOR}, ${OPERATOR_ADDRESS} — ${CONTACT_EMAIL}.
`;

const PRIVACY_EN = `# Privacy Policy

_Last updated: ${LEGAL_UPDATED}_

This policy explains how we handle personal data under the GDPR (Regulation (EU) 2016/679).

## 1. Controller

The controller of your personal data is ${OPERATOR}, ${OPERATOR_REG_EN}, ${OPERATOR_ADDRESS}. Contact: ${CONTACT_EMAIL}.

## 2. What we collect

- **Email address** — when you sign in (passwordless magic link) or request a report. This is the only identifying data we ask you for.
- **Technical data** — standard server logs (IP address, user agent, timestamps) generated when you visit, used for security and reliability.
- **Essential cookie** — a session cookie that keeps you signed in. No advertising or third-party analytics cookies are used.

We do **not** collect special-category data, and the brand/review data on the Service concerns companies, not you.

## 3. Purposes and legal bases

- Providing the Service and your account — Art. 6(1)(b) (performance of a contract).
- Security, abuse-prevention and reliability of the Service — Art. 6(1)(f) (legitimate interest).
- Sending a report you requested and related follow-up — Art. 6(1)(b)/(a) (contract / consent, which you can withdraw at any time).

## 4. Recipients / processors

We use vetted processors that act on our instructions:

- **Vercel Inc.** — hosting and delivery of the Service.
- **Neon Inc.** — managed database storage.
- **Resend** — sending transactional email (sign-in links, requested reports).

Third-party services that provide **public brand data** (e.g. Apify, DataForSEO) and our AI provider process information about brands, not your personal data.

## 5. Transfers outside the EEA

Some processors are located in the United States. Such transfers rely on appropriate safeguards under the GDPR (e.g. Standard Contractual Clauses and, where applicable, the EU–US Data Privacy Framework).

## 6. Retention

We keep account data for as long as your account exists and delete it on closure. Report-request data is kept only as long as needed to fulfil the request and for a reasonable follow-up period. Server logs are kept for a limited period for security.

## 7. Your rights

You have the right to access, rectification, erasure, restriction, objection and data portability, and to withdraw consent at any time. To exercise them, contact ${CONTACT_EMAIL}. You also have the right to lodge a complaint with a supervisory authority — in Poland, the President of the Personal Data Protection Office (**PUODO**), ul. Stawki 2, 00-193 Warszawa.

## 8. Cookies

We use only a **strictly necessary** session cookie for sign-in. Because we use no marketing or analytics cookies, no consent banner is required for it.

## 9. Changes

We may update this policy; the "last updated" date shows the current version. Material changes will be communicated to registered users.

## 10. Contact

Questions about this policy: ${CONTACT_EMAIL}.
`;

const TERMS_PL = `# Regulamin

_Ostatnia aktualizacja: ${LEGAL_UPDATED}_

## 1. Kto świadczy usługę

Niniejszy Regulamin określa zasady korzystania z serwisu **NeoBase** ("Serwis"), prowadzonego przez ${OPERATOR}, ${OPERATOR_REG_PL}, z siedzibą pod adresem ${OPERATOR_ADDRESS} ("Usługodawca", "my"). Korzystając z Serwisu, akceptujesz Regulamin; jeżeli się z nim nie zgadzasz, nie korzystaj z Serwisu.

## 2. Czym jest Serwis

NeoBase agreguje **publicznie dostępne informacje** o neobankach i giełdach kryptowalut — oceny i liczby opinii z platform zewnętrznych (np. Trustpilot, Google Play, App Store), dane z mediów, mediów społecznościowych oraz dane regulacyjne — i łączy je we własne wskaźniki, w tym **NeoBase Score**. Oferujemy także opcjonalne konta, raporty porównawcze oraz płatny monitoring.

## 3. Charakter informacji — brak porady

Serwis ma charakter **wyłącznie informacyjny**.

- Informacje pochodzą ze źródeł zewnętrznych i publicznych i **mogą być niekompletne, opóźnione lub niedokładne**. Nie gwarantujemy ich poprawności ani kompletności.
- **NeoBase Score to nasz autorski wskaźnik** obliczany z opisanych danych. Nie jest to oficjalny rating ani ocena zatwierdzona przez opisywane marki.
- Żadna treść w Serwisie nie stanowi **porady inwestycyjnej, finansowej, prawnej ani podatkowej** ani rekomendacji korzystania, nabycia lub zbycia jakiegokolwiek produktu lub usługi. Decyzje podejmowane na podstawie Serwisu podejmujesz na własną odpowiedzialność.

## 4. Konto

Niektóre funkcje wymagają konta. Stosujemy logowanie bez hasła: podajesz adres e-mail i otrzymujesz jednorazowy link logujący. Odpowiadasz za bezpieczeństwo dostępu do swojej poczty oraz za działania w ramach konta. Konto możesz w każdej chwili zamknąć, kontaktując się pod ${CONTACT_EMAIL}.

## 5. Usługi płatne

Plany płatne (np. monitoring, raporty) — jeśli oferowane — są opisywane w momencie zakupu, wraz z ceną i okresem rozliczeniowym. Płatności obsługuje nasz dostawca płatności; do transakcji stosuje się jego warunki. Konsumentom przysługują ustawowe prawa do odstąpienia w zakresie wymaganym prawem; szczegóły podawane są przy zakupie.

## 6. Zasady korzystania

Zobowiązujesz się nie: korzystać z Serwisu niezgodnie z prawem; scrapować, masowo pobierać ani systematycznie pozyskiwać danych inaczej niż przez udostępnione przez nas interfejsy; zakłócać ani testować zabezpieczeń Serwisu; przedstawiać NeoBase Score jako oficjalnego ratingu; naruszać praw naszych lub osób trzecich.

## 7. Własność intelektualna

Serwis, jego układ, treści oraz metodologia i wyniki NeoBase Score są chronione prawem. Bazowe oceny i znaki podmiotów trzecich należą do ich właścicieli. Możesz udostępniać i linkować nasze strony w celach niekomercyjnych z podaniem źródła; inne wykorzystanie wymaga naszej zgody.

## 8. Odpowiedzialność

W najszerszym zakresie dozwolonym prawem nie ponosimy odpowiedzialności za decyzje podjęte w oparciu o Serwis, za poprawność danych podmiotów trzecich ani za szkody pośrednie. Niniejsze zapisy nie ograniczają odpowiedzialności, której nie można ograniczyć na mocy prawa (w tym wobec konsumentów).

## 9. Reklamacje

Reklamację możesz złożyć pod ${CONTACT_EMAIL}. Odpowiadamy w terminie do 14 dni.

## 10. Zmiany

Możemy aktualizować Regulamin; data "ostatniej aktualizacji" wskazuje obowiązującą wersję. O istotnych zmianach dotyczących zarejestrowanych użytkowników poinformujemy e-mailem lub w Serwisie.

## 11. Prawo właściwe

Regulamin podlega prawu polskiemu oraz właściwemu prawu UE, bez uszczerbku dla bezwzględnie obowiązujących przepisów ochrony konsumentów kraju Twojego zamieszkania. Spory podlegają właściwym sądom, z zachowaniem ustawowych praw konsumentów.

## 12. Kontakt

${OPERATOR}, ${OPERATOR_ADDRESS} — ${CONTACT_EMAIL}.
`;

const PRIVACY_PL = `# Polityka prywatności

_Ostatnia aktualizacja: ${LEGAL_UPDATED}_

Niniejsza polityka wyjaśnia, jak przetwarzamy dane osobowe zgodnie z RODO (Rozporządzenie (UE) 2016/679).

## 1. Administrator

Administratorem Twoich danych osobowych jest ${OPERATOR}, ${OPERATOR_REG_PL}, ${OPERATOR_ADDRESS}. Kontakt: ${CONTACT_EMAIL}.

## 2. Jakie dane zbieramy

- **Adres e-mail** — gdy się logujesz (link magic-link bez hasła) lub zamawiasz raport. To jedyna dana identyfikująca, o którą prosimy.
- **Dane techniczne** — standardowe logi serwera (adres IP, przeglądarka, znaczniki czasu) powstające podczas wizyty, wykorzystywane dla bezpieczeństwa i niezawodności.
- **Niezbędny cookie** — sesyjny plik cookie utrzymujący zalogowanie. Nie stosujemy cookies reklamowych ani analitycznych podmiotów trzecich.

**Nie** zbieramy danych szczególnych kategorii, a dane o markach/opiniach w Serwisie dotyczą firm, a nie Ciebie.

## 3. Cele i podstawy prawne

- Świadczenie usługi i prowadzenie konta — art. 6 ust. 1 lit. b (wykonanie umowy).
- Bezpieczeństwo, przeciwdziałanie nadużyciom i niezawodność Serwisu — art. 6 ust. 1 lit. f (prawnie uzasadniony interes).
- Wysłanie zamówionego raportu i związany z tym kontakt — art. 6 ust. 1 lit. b/a (umowa / zgoda, którą możesz w każdej chwili wycofać).

## 4. Odbiorcy / podmioty przetwarzające

Korzystamy ze sprawdzonych podmiotów przetwarzających, działających na nasze polecenie:

- **Vercel Inc.** — hosting i dostarczanie Serwisu.
- **Neon Inc.** — zarządzana baza danych.
- **Resend** — wysyłka e-maili transakcyjnych (linki logujące, zamówione raporty).

Usługi dostarczające **publiczne dane o markach** (np. Apify, DataForSEO) oraz nasz dostawca AI przetwarzają informacje o markach, a nie Twoje dane osobowe.

## 5. Przekazywanie poza EOG

Część podmiotów przetwarzających ma siedzibę w Stanach Zjednoczonych. Takie przekazywanie odbywa się w oparciu o odpowiednie zabezpieczenia zgodne z RODO (np. standardowe klauzule umowne oraz, w stosownych przypadkach, Ramy Ochrony Danych UE–USA).

## 6. Okres przechowywania

Dane konta przechowujemy przez czas jego istnienia i usuwamy po zamknięciu. Dane z zamówienia raportu przechowujemy tylko tak długo, jak to potrzebne do realizacji i rozsądnego okresu kontaktu. Logi serwera przechowujemy przez ograniczony czas dla bezpieczeństwa.

## 7. Twoje prawa

Masz prawo do dostępu, sprostowania, usunięcia, ograniczenia, sprzeciwu i przenoszenia danych oraz do wycofania zgody w dowolnym momencie. Aby z nich skorzystać, napisz na ${CONTACT_EMAIL}. Masz też prawo wniesienia skargi do organu nadzorczego — w Polsce do Prezesa Urzędu Ochrony Danych Osobowych (**PUODO**), ul. Stawki 2, 00-193 Warszawa.

## 8. Pliki cookie

Stosujemy wyłącznie **niezbędny** sesyjny plik cookie do logowania. Ponieważ nie używamy cookies marketingowych ani analitycznych, baner zgody nie jest dla niego wymagany.

## 9. Zmiany

Możemy aktualizować tę politykę; data "ostatniej aktualizacji" wskazuje obowiązującą wersję. O istotnych zmianach poinformujemy zarejestrowanych użytkowników.

## 10. Kontakt

Pytania dotyczące polityki: ${CONTACT_EMAIL}.
`;

const TERMS: Record<string, string> = { en: TERMS_EN, pl: TERMS_PL };
const PRIVACY: Record<string, string> = { en: PRIVACY_EN, pl: PRIVACY_PL };

/**
 * Markdown body for a legal document in the requested locale. `localized` is
 * false when we fell back to English (de/es/fr until a reviewed translation
 * lands), so the page can flag it if it wants to.
 */
export function getLegal(kind: LegalKind, locale: string): { body: string; localized: boolean } {
  const map = kind === "terms" ? TERMS : PRIVACY;
  const body = map[locale] ?? map[routing.defaultLocale];
  return { body, localized: map[locale] != null };
}
