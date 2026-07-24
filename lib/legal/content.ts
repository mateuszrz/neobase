/**
 * Terms of Service + Privacy Policy content, as Markdown per locale, rendered by
 * the /terms and /privacy pages through <Markdown>.
 *
 * ⚠️ DRAFT - legal review required before this is relied on. English + Polish are
 * authored; German, Spanish and French are machine translations of the English
 * and must be reviewed before they can be relied on in those markets.
 *
 * Operator's decision: publish name + CEIDG sole-proprietorship form + contact
 * email only; NIP, REGON and registered address are omitted. NOTE for the legal
 * review: Polish law (UŚUDE art. 5, consumer-protection rules) generally expects
 * the provider's address to be available, especially for paid services.
 *
 * Keep LEGAL_UPDATED in step with any substantive edit.
 */

import { routing } from "@/i18n/routing";

export type LegalKind = "terms" | "privacy";

export const LEGAL_UPDATED = "2026-07-24"; // ISO date of the last substantive change

const OPERATOR = "The Clarity Mateusz Rzetecki";
const CONTACT_EMAIL = "contact@neobase.co";

// Sole-proprietorship (CEIDG) descriptor, worded per language.
const REG: Record<string, string> = {
  en: "a sole proprietorship registered in the Polish Central Registration and Information on Business (CEIDG)",
  pl: "prowadzącego jednoosobową działalność gospodarczą wpisaną do CEIDG",
  de: "ein im polnischen Gewerberegister (CEIDG) eingetragenes Einzelunternehmen",
  es: "una empresa individual inscrita en el Registro Central de Actividad Económica de Polonia (CEIDG)",
  fr: "une entreprise individuelle enregistrée au registre polonais des entreprises (CEIDG)",
};

// ── English ──────────────────────────────────────────────────────────────────
const TERMS_EN = `# Terms of Service

_Last updated: ${LEGAL_UPDATED}_

## 1. Who we are

These Terms govern your use of **NeoBase** (the "Service"), operated by ${OPERATOR}, ${REG.en} (the "Operator", "we", "us"), reachable at ${CONTACT_EMAIL}. By using the Service you agree to these Terms; if you do not agree, please do not use the Service.

## 2. What the Service does

NeoBase aggregates **publicly available information** about neobanks and crypto-exchanges - ratings and review counts from third-party platforms (e.g. Trustpilot, Google Play, the App Store), public news, social and regulatory data - and combines it into our own composite indicators, including the **NeoBase Score**. We also offer optional accounts, competitive reports and paid monitoring.

## 3. Nature of the information - no advice

The Service is provided **for information purposes only**.

- The information is aggregated from third-party and public sources and **may be incomplete, delayed or inaccurate**. We do not warrant its accuracy or completeness.
- The **NeoBase Score is our own editorial indicator**, computed from the data described above. It is not an official rating and not endorsed by the brands it describes.
- Nothing on the Service is **investment, financial, legal or tax advice**, nor a recommendation to use, buy or sell any product or service. Decisions you make based on the Service are your own responsibility.

## 4. Accounts

Some features require an account. We use passwordless sign-in: you enter your email and receive a one-time sign-in link. You are responsible for keeping access to your email secure and for activity under your account. You may close your account at any time by contacting ${CONTACT_EMAIL}.

## 5. Paid services

Paid plans (e.g. monitoring, reports) - where offered - are described at the point of purchase, including price and billing period. Payments are handled by our payment provider; their terms apply to the transaction. Statutory withdrawal rights for consumers apply where required by law; details are provided at checkout.

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

${OPERATOR} - ${CONTACT_EMAIL}.
`;

const PRIVACY_EN = `# Privacy Policy

_Last updated: ${LEGAL_UPDATED}_

This policy explains how we handle personal data under the GDPR (Regulation (EU) 2016/679).

## 1. Controller

The controller of your personal data is ${OPERATOR}, ${REG.en}. Contact: ${CONTACT_EMAIL}.

## 2. What we collect

- **Email address** - when you sign in (passwordless magic link) or request a report. This is the only identifying data we ask you for.
- **Technical data** - standard server logs (IP address, user agent, timestamps) generated when you visit, used for security and reliability.
- **Cookies and analytics** - an essential session cookie keeps you signed in. With your consent, we also use Google Analytics 4, which sets cookies and collects aggregated usage data (such as pages viewed and approximate location) to help us improve the Service.

We do **not** collect special-category data, and the brand/review data on the Service concerns companies, not you.

## 3. Purposes and legal bases

- Providing the Service and your account - Art. 6(1)(b) (performance of a contract).
- Security, abuse-prevention and reliability of the Service - Art. 6(1)(f) (legitimate interest).
- Sending a report you requested and related follow-up - Art. 6(1)(b)/(a) (contract / consent, which you can withdraw at any time).

## 4. Recipients / processors

We use vetted processors that act on our instructions:

- **Cloud hosting and infrastructure providers** - hosting, content delivery and database storage of the Service, within the EU/EEA or under appropriate safeguards.
- **Resend** - sending transactional email (sign-in links, requested reports).
- **Google (Google Analytics 4)** - website usage analytics, loaded only with your consent.
- **Cybot A/S (Cookiebot)** - cookie-consent management.

Third-party services that provide **public brand data** (e.g. Apify, DataForSEO) and our AI provider process information about brands, not your personal data.

## 5. Transfers outside the EEA

Some processors are located in the United States. Such transfers rely on appropriate safeguards under the GDPR (e.g. Standard Contractual Clauses and, where applicable, the EU-US Data Privacy Framework).

## 6. Retention

We keep account data for as long as your account exists and delete it on closure. Report-request data is kept only as long as needed to fulfil the request and for a reasonable follow-up period. Server logs are kept for a limited period for security.

## 7. Your rights

You have the right to access, rectification, erasure, restriction, objection and data portability, and to withdraw consent at any time. To exercise them, contact ${CONTACT_EMAIL}. You also have the right to lodge a complaint with a supervisory authority - in Poland, the President of the Personal Data Protection Office (**PUODO**), ul. Stawki 2, 00-193 Warszawa.

## 8. Cookies

A **strictly necessary** session cookie keeps you signed in and is always active. We also use **Google Analytics 4** to understand how the Service is used; its analytics cookies are set only after you consent. Consent for non-essential cookies is collected and managed through **Cookiebot**, and you can change or withdraw it at any time in the cookie settings.

## 9. Changes

We may update this policy; the "last updated" date shows the current version. Material changes will be communicated to registered users.

## 10. Contact

Questions about this policy: ${CONTACT_EMAIL}.
`;

// ── Polish ───────────────────────────────────────────────────────────────────
const TERMS_PL = `# Regulamin

_Ostatnia aktualizacja: ${LEGAL_UPDATED}_

## 1. Kto świadczy usługę

Niniejszy Regulamin określa zasady korzystania z serwisu **NeoBase** ("Serwis"), prowadzonego przez ${OPERATOR}, ${REG.pl} ("Usługodawca", "my"), z którym można kontaktować się pod adresem ${CONTACT_EMAIL}. Korzystając z Serwisu, akceptujesz Regulamin; jeżeli się z nim nie zgadzasz, nie korzystaj z Serwisu.

## 2. Czym jest Serwis

NeoBase agreguje **publicznie dostępne informacje** o neobankach i giełdach kryptowalut - oceny i liczby opinii z platform zewnętrznych (np. Trustpilot, Google Play, App Store), dane z mediów, mediów społecznościowych oraz dane regulacyjne - i łączy je we własne wskaźniki, w tym **NeoBase Score**. Oferujemy także opcjonalne konta, raporty porównawcze oraz płatny monitoring.

## 3. Charakter informacji - brak porady

Serwis ma charakter **wyłącznie informacyjny**.

- Informacje pochodzą ze źródeł zewnętrznych i publicznych i **mogą być niekompletne, opóźnione lub niedokładne**. Nie gwarantujemy ich poprawności ani kompletności.
- **NeoBase Score to nasz autorski wskaźnik** obliczany z opisanych danych. Nie jest to oficjalny rating ani ocena zatwierdzona przez opisywane marki.
- Żadna treść w Serwisie nie stanowi **porady inwestycyjnej, finansowej, prawnej ani podatkowej** ani rekomendacji korzystania, nabycia lub zbycia jakiegokolwiek produktu lub usługi. Decyzje podejmowane na podstawie Serwisu podejmujesz na własną odpowiedzialność.

## 4. Konto

Niektóre funkcje wymagają konta. Stosujemy logowanie bez hasła: podajesz adres e-mail i otrzymujesz jednorazowy link logujący. Odpowiadasz za bezpieczeństwo dostępu do swojej poczty oraz za działania w ramach konta. Konto możesz w każdej chwili zamknąć, kontaktując się pod ${CONTACT_EMAIL}.

## 5. Usługi płatne

Plany płatne (np. monitoring, raporty) - jeśli oferowane - są opisywane w momencie zakupu, wraz z ceną i okresem rozliczeniowym. Płatności obsługuje nasz dostawca płatności; do transakcji stosuje się jego warunki. Konsumentom przysługują ustawowe prawa do odstąpienia w zakresie wymaganym prawem; szczegóły podawane są przy zakupie.

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

${OPERATOR} - ${CONTACT_EMAIL}.
`;

const PRIVACY_PL = `# Polityka prywatności

_Ostatnia aktualizacja: ${LEGAL_UPDATED}_

Niniejsza polityka wyjaśnia, jak przetwarzamy dane osobowe zgodnie z RODO (Rozporządzenie (UE) 2016/679).

## 1. Administrator

Administratorem Twoich danych osobowych jest ${OPERATOR}, ${REG.pl}. Kontakt: ${CONTACT_EMAIL}.

## 2. Jakie dane zbieramy

- **Adres e-mail** - gdy się logujesz (link magic-link bez hasła) lub zamawiasz raport. To jedyna dana identyfikująca, o którą prosimy.
- **Dane techniczne** - standardowe logi serwera (adres IP, przeglądarka, znaczniki czasu) powstające podczas wizyty, wykorzystywane dla bezpieczeństwa i niezawodności.
- **Pliki cookie i analityka** - niezbędny sesyjny plik cookie utrzymuje zalogowanie. Za Twoją zgodą korzystamy też z Google Analytics 4, który zapisuje pliki cookie i zbiera zagregowane dane o użytkowaniu (np. odwiedzone strony, przybliżoną lokalizację), aby ulepszać Serwis.

**Nie** zbieramy danych szczególnych kategorii, a dane o markach/opiniach w Serwisie dotyczą firm, a nie Ciebie.

## 3. Cele i podstawy prawne

- Świadczenie usługi i prowadzenie konta - art. 6 ust. 1 lit. b (wykonanie umowy).
- Bezpieczeństwo, przeciwdziałanie nadużyciom i niezawodność Serwisu - art. 6 ust. 1 lit. f (prawnie uzasadniony interes).
- Wysłanie zamówionego raportu i związany z tym kontakt - art. 6 ust. 1 lit. b/a (umowa / zgoda, którą możesz w każdej chwili wycofać).

## 4. Odbiorcy / podmioty przetwarzające

Korzystamy ze sprawdzonych podmiotów przetwarzających, działających na nasze polecenie:

- **Dostawcy hostingu i infrastruktury chmurowej** - hosting, dostarczanie i przechowywanie bazy danych Serwisu, w UE/EOG lub z odpowiednimi zabezpieczeniami.
- **Resend** - wysyłka e-maili transakcyjnych (linki logujące, zamówione raporty).
- **Google (Google Analytics 4)** - analityka korzystania z serwisu, ładowana wyłącznie za Twoją zgodą.
- **Cybot A/S (Cookiebot)** - zarządzanie zgodami na pliki cookie.

Usługi dostarczające **publiczne dane o markach** (np. Apify, DataForSEO) oraz nasz dostawca AI przetwarzają informacje o markach, a nie Twoje dane osobowe.

## 5. Przekazywanie poza EOG

Część podmiotów przetwarzających ma siedzibę w Stanach Zjednoczonych. Takie przekazywanie odbywa się w oparciu o odpowiednie zabezpieczenia zgodne z RODO (np. standardowe klauzule umowne oraz, w stosownych przypadkach, Ramy Ochrony Danych UE-USA).

## 6. Okres przechowywania

Dane konta przechowujemy przez czas jego istnienia i usuwamy po zamknięciu. Dane z zamówienia raportu przechowujemy tylko tak długo, jak to potrzebne do realizacji i rozsądnego okresu kontaktu. Logi serwera przechowujemy przez ograniczony czas dla bezpieczeństwa.

## 7. Twoje prawa

Masz prawo do dostępu, sprostowania, usunięcia, ograniczenia, sprzeciwu i przenoszenia danych oraz do wycofania zgody w dowolnym momencie. Aby z nich skorzystać, napisz na ${CONTACT_EMAIL}. Masz też prawo wniesienia skargi do organu nadzorczego - w Polsce do Prezesa Urzędu Ochrony Danych Osobowych (**PUODO**), ul. Stawki 2, 00-193 Warszawa.

## 8. Pliki cookie

Niezbędny sesyjny plik cookie utrzymuje zalogowanie i jest zawsze aktywny. Korzystamy też z **Google Analytics 4**, aby rozumieć, jak używany jest Serwis; jego pliki cookie analityczne zapisywane są dopiero po wyrażeniu przez Ciebie zgody. Zgody na pliki cookie inne niż niezbędne zbieramy i zarządzamy przez **Cookiebot**; możesz je zmienić lub wycofać w dowolnym momencie w ustawieniach cookie.

## 9. Zmiany

Możemy aktualizować tę politykę; data "ostatniej aktualizacji" wskazuje obowiązującą wersję. O istotnych zmianach poinformujemy zarejestrowanych użytkowników.

## 10. Kontakt

Pytania dotyczące polityki: ${CONTACT_EMAIL}.
`;

// ── German (machine translation - review pending) ────────────────────────────
const TERMS_DE = `# Nutzungsbedingungen

_Zuletzt aktualisiert: ${LEGAL_UPDATED}_

## 1. Wer wir sind

Diese Nutzungsbedingungen regeln Ihre Nutzung von **NeoBase** (der „Dienst"), betrieben von ${OPERATOR}, ${REG.de} (der „Betreiber", „wir", „uns"), erreichbar unter ${CONTACT_EMAIL}. Mit der Nutzung des Dienstes stimmen Sie diesen Bedingungen zu; wenn Sie nicht einverstanden sind, nutzen Sie den Dienst bitte nicht.

## 2. Was der Dienst tut

NeoBase bündelt **öffentlich zugängliche Informationen** über Neobanken und Krypto-Börsen - Bewertungen und Bewertungszahlen von Drittplattformen (z. B. Trustpilot, Google Play, App Store), öffentliche Nachrichten, Social-Media- und Regulierungsdaten - und fasst sie zu eigenen zusammengesetzten Kennzahlen zusammen, einschließlich des **NeoBase Score**. Wir bieten außerdem optionale Konten, Wettbewerbsberichte und kostenpflichtiges Monitoring an.

## 3. Art der Informationen - keine Beratung

Der Dienst wird **ausschließlich zu Informationszwecken** bereitgestellt.

- Die Informationen stammen aus Dritt- und öffentlichen Quellen und **können unvollständig, verzögert oder ungenau sein**. Wir übernehmen keine Gewähr für ihre Richtigkeit oder Vollständigkeit.
- Der **NeoBase Score ist unsere eigene redaktionelle Kennzahl**, berechnet aus den oben beschriebenen Daten. Es handelt sich nicht um ein offizielles Rating und er ist nicht von den beschriebenen Marken bestätigt.
- Nichts im Dienst stellt eine **Anlage-, Finanz-, Rechts- oder Steuerberatung** dar, noch eine Empfehlung, ein Produkt oder eine Dienstleistung zu nutzen, zu kaufen oder zu verkaufen. Entscheidungen, die Sie auf Grundlage des Dienstes treffen, liegen in Ihrer eigenen Verantwortung.

## 4. Konten

Einige Funktionen erfordern ein Konto. Wir nutzen eine passwortlose Anmeldung: Sie geben Ihre E-Mail-Adresse ein und erhalten einen einmaligen Anmeldelink. Sie sind für die Sicherheit des Zugangs zu Ihrem E-Mail-Postfach und für Aktivitäten unter Ihrem Konto verantwortlich. Sie können Ihr Konto jederzeit schließen, indem Sie sich an ${CONTACT_EMAIL} wenden.

## 5. Kostenpflichtige Dienste

Kostenpflichtige Pläne (z. B. Monitoring, Berichte) - sofern angeboten - werden zum Zeitpunkt des Kaufs beschrieben, einschließlich Preis und Abrechnungszeitraum. Zahlungen werden von unserem Zahlungsdienstleister abgewickelt; für die Transaktion gelten dessen Bedingungen. Gesetzliche Widerrufsrechte für Verbraucher gelten, soweit gesetzlich vorgeschrieben; Einzelheiten werden beim Bezahlvorgang mitgeteilt.

## 6. Zulässige Nutzung

Sie verpflichten sich, nicht: den Dienst rechtswidrig zu nutzen; Daten außerhalb der von uns bereitgestellten Schnittstellen zu scrapen, massenhaft herunterzuladen oder systematisch zu extrahieren; die Sicherheit des Dienstes zu stören oder zu testen; den NeoBase Score als offizielles Rating darzustellen; oder unsere Rechte oder die Rechte Dritter zu verletzen.

## 7. Geistiges Eigentum

Der Dienst, sein Design, seine Texte sowie die Methodik und Ergebnisse des NeoBase Score sind gesetzlich geschützt. Zugrunde liegende Drittbewertungen und Marken gehören ihren jeweiligen Inhabern. Sie dürfen unsere Seiten zu nicht-kommerziellen Zwecken mit Quellenangabe teilen und verlinken; jede andere Nutzung bedarf unserer Zustimmung.

## 8. Haftung

Soweit gesetzlich zulässig, haften wir nicht für Entscheidungen, die im Vertrauen auf den Dienst getroffen werden, für die Richtigkeit von Drittdaten oder für mittelbare Schäden oder Folgeschäden. Nichts hierin beschränkt eine Haftung, die gesetzlich nicht beschränkt werden kann (auch gegenüber Verbrauchern).

## 9. Beschwerden

Sie können eine Beschwerde unter ${CONTACT_EMAIL} einreichen. Wir bemühen uns, innerhalb von 14 Tagen zu antworten.

## 10. Änderungen

Wir können diese Bedingungen aktualisieren; das Datum „zuletzt aktualisiert" gibt die aktuelle Fassung an. Wesentliche Änderungen, die registrierte Nutzer betreffen, werden per E-Mail oder im Dienst mitgeteilt.

## 11. Anwendbares Recht

Diese Bedingungen unterliegen polnischem Recht und dem anwendbaren EU-Recht, unbeschadet zwingender Verbraucherschutzvorschriften Ihres Wohnsitzlandes. Streitigkeiten unterliegen den zuständigen Gerichten, vorbehaltlich der gesetzlichen Rechte der Verbraucher.

## 12. Kontakt

${OPERATOR} - ${CONTACT_EMAIL}.
`;

const PRIVACY_DE = `# Datenschutzerklärung

_Zuletzt aktualisiert: ${LEGAL_UPDATED}_

Diese Erklärung beschreibt, wie wir personenbezogene Daten nach der DSGVO (Verordnung (EU) 2016/679) verarbeiten.

## 1. Verantwortlicher

Verantwortlicher für Ihre personenbezogenen Daten ist ${OPERATOR}, ${REG.de}. Kontakt: ${CONTACT_EMAIL}.

## 2. Welche Daten wir erheben

- **E-Mail-Adresse** - wenn Sie sich anmelden (passwortloser Magic Link) oder einen Bericht anfordern. Dies ist das einzige identifizierende Datum, um das wir Sie bitten.
- **Technische Daten** - übliche Server-Logs (IP-Adresse, User-Agent, Zeitstempel), die bei Ihrem Besuch anfallen und der Sicherheit und Zuverlässigkeit dienen.
- **Cookies und Analyse** - ein notwendiges Sitzungs-Cookie hält Sie angemeldet. Mit Ihrer Einwilligung nutzen wir zudem Google Analytics 4, das Cookies setzt und aggregierte Nutzungsdaten (z. B. aufgerufene Seiten, ungefährer Standort) erhebt, um den Dienst zu verbessern.

Wir erheben **keine** besonderen Kategorien personenbezogener Daten; die Marken-/Bewertungsdaten im Dienst betreffen Unternehmen, nicht Sie.

## 3. Zwecke und Rechtsgrundlagen

- Bereitstellung des Dienstes und Ihres Kontos - Art. 6 Abs. 1 lit. b (Vertragserfüllung).
- Sicherheit, Missbrauchsprävention und Zuverlässigkeit des Dienstes - Art. 6 Abs. 1 lit. f (berechtigtes Interesse).
- Versand eines von Ihnen angeforderten Berichts und damit verbundene Kontaktaufnahme - Art. 6 Abs. 1 lit. b/a (Vertrag / Einwilligung, die Sie jederzeit widerrufen können).

## 4. Empfänger / Auftragsverarbeiter

Wir setzen geprüfte Auftragsverarbeiter ein, die auf unsere Weisung handeln:

- **Anbieter von Cloud-Hosting und -Infrastruktur** - Hosting, Bereitstellung und Datenbankspeicherung des Dienstes, in der EU/im EWR oder mit angemessenen Garantien.
- **Google (Google Analytics 4)** - Nutzungsanalyse der Website, nur mit Ihrer Einwilligung geladen.
- **Cybot A/S (Cookiebot)** - Verwaltung der Cookie-Einwilligung.
- **Resend** - Versand von Transaktions-E-Mails (Anmeldelinks, angeforderte Berichte).

Dienste, die **öffentliche Markendaten** liefern (z. B. Apify, DataForSEO), sowie unser KI-Anbieter verarbeiten Informationen über Marken, nicht Ihre personenbezogenen Daten.

## 5. Übermittlungen außerhalb des EWR

Einige Auftragsverarbeiter befinden sich in den Vereinigten Staaten. Solche Übermittlungen stützen sich auf geeignete Garantien nach der DSGVO (z. B. Standardvertragsklauseln und, sofern zutreffend, den EU-US Data Privacy Framework).

## 6. Speicherdauer

Kontodaten speichern wir, solange Ihr Konto besteht, und löschen sie bei dessen Schließung. Daten aus Berichtsanfragen werden nur so lange gespeichert, wie es zur Erfüllung der Anfrage und für einen angemessenen Nachbearbeitungszeitraum erforderlich ist. Server-Logs werden aus Sicherheitsgründen für einen begrenzten Zeitraum aufbewahrt.

## 7. Ihre Rechte

Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch und Datenübertragbarkeit sowie das Recht, eine Einwilligung jederzeit zu widerrufen. Zur Ausübung wenden Sie sich an ${CONTACT_EMAIL}. Sie haben zudem das Recht, sich bei einer Aufsichtsbehörde zu beschweren - in Polen beim Präsidenten des Amtes für den Schutz personenbezogener Daten (**PUODO**), ul. Stawki 2, 00-193 Warschau.

## 8. Cookies

Ein **unbedingt erforderliches** Sitzungs-Cookie hält Sie angemeldet und ist immer aktiv. Wir nutzen außerdem **Google Analytics 4**, um zu verstehen, wie der Dienst genutzt wird; dessen Analyse-Cookies werden erst nach Ihrer Einwilligung gesetzt. Die Einwilligung für nicht notwendige Cookies wird über **Cookiebot** eingeholt und verwaltet; Sie können sie jederzeit in den Cookie-Einstellungen ändern oder widerrufen.

## 9. Änderungen

Wir können diese Erklärung aktualisieren; das Datum „zuletzt aktualisiert" zeigt die aktuelle Fassung. Über wesentliche Änderungen werden registrierte Nutzer informiert.

## 10. Kontakt

Fragen zu dieser Erklärung: ${CONTACT_EMAIL}.
`;

// ── Spanish (machine translation - review pending) ───────────────────────────
const TERMS_ES = `# Términos del servicio

_Última actualización: ${LEGAL_UPDATED}_

## 1. Quiénes somos

Estos Términos rigen tu uso de **NeoBase** (el «Servicio»), operado por ${OPERATOR}, ${REG.es} (el «Operador», «nosotros»), con contacto en ${CONTACT_EMAIL}. Al usar el Servicio aceptas estos Términos; si no estás de acuerdo, no utilices el Servicio.

## 2. Qué hace el Servicio

NeoBase agrega **información disponible públicamente** sobre neobancos y exchanges de criptomonedas - valoraciones y número de reseñas de plataformas de terceros (p. ej. Trustpilot, Google Play, App Store), noticias públicas, datos de redes sociales y regulatorios - y los combina en nuestros propios indicadores compuestos, incluido el **NeoBase Score**. También ofrecemos cuentas opcionales, informes competitivos y monitorización de pago.

## 3. Naturaleza de la información - sin asesoramiento

El Servicio se presta **únicamente con fines informativos**.

- La información se agrega de fuentes de terceros y públicas y **puede estar incompleta, retrasada o ser inexacta**. No garantizamos su exactitud ni su integridad.
- El **NeoBase Score es nuestro propio indicador editorial**, calculado a partir de los datos descritos. No es una calificación oficial ni está respaldado por las marcas que describe.
- Nada en el Servicio constituye **asesoramiento de inversión, financiero, legal o fiscal**, ni una recomendación para usar, comprar o vender ningún producto o servicio. Las decisiones que tomes basándote en el Servicio son tu propia responsabilidad.

## 4. Cuentas

Algunas funciones requieren una cuenta. Usamos inicio de sesión sin contraseña: introduces tu correo y recibes un enlace de acceso de un solo uso. Eres responsable de mantener seguro el acceso a tu correo y de la actividad en tu cuenta. Puedes cerrar tu cuenta en cualquier momento escribiendo a ${CONTACT_EMAIL}.

## 5. Servicios de pago

Los planes de pago (p. ej. monitorización, informes) - cuando se ofrezcan - se describen en el momento de la compra, incluidos el precio y el periodo de facturación. Los pagos los gestiona nuestro proveedor de pagos; sus condiciones se aplican a la transacción. Los derechos legales de desistimiento para consumidores se aplican cuando lo exija la ley; los detalles se facilitan al finalizar la compra.

## 6. Uso aceptable

Te comprometes a no: usar el Servicio de forma ilícita; hacer scraping, descargar de forma masiva o extraer datos sistemáticamente salvo mediante las interfaces que proporcionamos; interrumpir o sondear la seguridad del Servicio; presentar el NeoBase Score como una calificación oficial; o infringir nuestros derechos o los de terceros.

## 7. Propiedad intelectual

El Servicio, su diseño, sus textos y la metodología y resultados del NeoBase Score están protegidos por la ley. Las valoraciones y marcas subyacentes de terceros pertenecen a sus respectivos titulares. Puedes compartir y enlazar nuestras páginas con fines no comerciales citando la fuente; cualquier otro uso requiere nuestro consentimiento.

## 8. Responsabilidad

En la máxima medida permitida por la ley, no somos responsables de las decisiones tomadas confiando en el Servicio, de la exactitud de los datos de terceros ni de daños indirectos o consecuentes. Nada de lo aquí dispuesto limita la responsabilidad que no pueda limitarse por ley (incluido frente a consumidores).

## 9. Reclamaciones

Puedes presentar una reclamación en ${CONTACT_EMAIL}. Procuramos responder en un plazo de 14 días.

## 10. Cambios

Podemos actualizar estos Términos; la fecha de «última actualización» refleja la versión vigente. Los cambios sustanciales que afecten a los usuarios registrados se comunicarán por correo o en el Servicio.

## 11. Ley aplicable

Estos Términos se rigen por la legislación polaca y el Derecho aplicable de la UE, sin perjuicio de las normas imperativas de protección al consumidor de tu país de residencia. Las controversias se someten a los tribunales competentes, sin perjuicio de los derechos legales de los consumidores.

## 12. Contacto

${OPERATOR} - ${CONTACT_EMAIL}.
`;

const PRIVACY_ES = `# Política de privacidad

_Última actualización: ${LEGAL_UPDATED}_

Esta política explica cómo tratamos los datos personales conforme al RGPD (Reglamento (UE) 2016/679).

## 1. Responsable

El responsable de tus datos personales es ${OPERATOR}, ${REG.es}. Contacto: ${CONTACT_EMAIL}.

## 2. Qué recopilamos

- **Dirección de correo electrónico** - cuando inicias sesión (enlace mágico sin contraseña) o solicitas un informe. Es el único dato identificativo que te pedimos.
- **Datos técnicos** - registros estándar del servidor (dirección IP, agente de usuario, marcas de tiempo) generados durante tu visita, usados por seguridad y fiabilidad.
- **Cookies y analítica** - una cookie de sesión esencial te mantiene con la sesión iniciada. Con tu consentimiento, también usamos Google Analytics 4, que instala cookies y recopila datos agregados de uso (como páginas vistas y ubicación aproximada) para mejorar el Servicio.

**No** recopilamos categorías especiales de datos, y los datos de marcas/reseñas del Servicio se refieren a empresas, no a ti.

## 3. Fines y bases jurídicas

- Prestación del Servicio y de tu cuenta - art. 6.1.b (ejecución de un contrato).
- Seguridad, prevención de abusos y fiabilidad del Servicio - art. 6.1.f (interés legítimo).
- Envío de un informe que hayas solicitado y contacto relacionado - art. 6.1.b/a (contrato / consentimiento, que puedes retirar en cualquier momento).

## 4. Destinatarios / encargados

Utilizamos encargados verificados que actúan según nuestras instrucciones:

- **Proveedores de alojamiento e infraestructura en la nube** - alojamiento, entrega y almacenamiento de base de datos del Servicio, en la UE/EEE o con garantías adecuadas.
- **Google (Google Analytics 4)** - analítica de uso del sitio, cargada solo con tu consentimiento.
- **Cybot A/S (Cookiebot)** - gestión del consentimiento de cookies.
- **Resend** - envío de correos transaccionales (enlaces de acceso, informes solicitados).

Los servicios que aportan **datos públicos de marcas** (p. ej. Apify, DataForSEO) y nuestro proveedor de IA tratan información sobre marcas, no tus datos personales.

## 5. Transferencias fuera del EEE

Algunos encargados están ubicados en los Estados Unidos. Dichas transferencias se basan en garantías adecuadas conforme al RGPD (p. ej. cláusulas contractuales tipo y, cuando proceda, el Marco de Privacidad de Datos UE-EE. UU.).

## 6. Conservación

Conservamos los datos de la cuenta mientras exista tu cuenta y los eliminamos al cerrarla. Los datos de la solicitud de informe se conservan solo el tiempo necesario para atender la solicitud y durante un periodo razonable de seguimiento. Los registros del servidor se conservan un tiempo limitado por seguridad.

## 7. Tus derechos

Tienes derecho de acceso, rectificación, supresión, limitación, oposición y portabilidad, y a retirar el consentimiento en cualquier momento. Para ejercerlos, escribe a ${CONTACT_EMAIL}. También tienes derecho a presentar una reclamación ante una autoridad de control - en Polonia, el Presidente de la Oficina de Protección de Datos Personales (**PUODO**), ul. Stawki 2, 00-193 Varsovia.

## 8. Cookies

Una cookie de sesión **estrictamente necesaria** te mantiene con la sesión iniciada y está siempre activa. También usamos **Google Analytics 4** para entender cómo se utiliza el Servicio; sus cookies de analítica se instalan solo después de tu consentimiento. El consentimiento para las cookies no esenciales se recoge y gestiona mediante **Cookiebot**, y puedes cambiarlo o retirarlo en cualquier momento en la configuración de cookies.

## 9. Cambios

Podemos actualizar esta política; la fecha de «última actualización» muestra la versión vigente. Los cambios sustanciales se comunicarán a los usuarios registrados.

## 10. Contacto

Consultas sobre esta política: ${CONTACT_EMAIL}.
`;

// ── French (machine translation - review pending) ────────────────────────────
const TERMS_FR = `# Conditions d'utilisation

_Dernière mise à jour : ${LEGAL_UPDATED}_

## 1. Qui nous sommes

Les présentes Conditions régissent votre utilisation de **NeoBase** (le « Service »), exploité par ${OPERATOR}, ${REG.fr} (l'« Exploitant », « nous »), joignable à ${CONTACT_EMAIL}. En utilisant le Service, vous acceptez ces Conditions ; si vous n'êtes pas d'accord, veuillez ne pas utiliser le Service.

## 2. Ce que fait le Service

NeoBase agrège des **informations accessibles au public** sur les néobanques et les plateformes d'échange de cryptomonnaies - notes et nombres d'avis provenant de plateformes tierces (par ex. Trustpilot, Google Play, App Store), actualités publiques, données de réseaux sociaux et données réglementaires - et les combine en nos propres indicateurs composites, dont le **NeoBase Score**. Nous proposons également des comptes optionnels, des rapports concurrentiels et une surveillance payante.

## 3. Nature des informations - pas de conseil

Le Service est fourni **à titre purement informatif**.

- Les informations sont agrégées à partir de sources tierces et publiques et **peuvent être incomplètes, tardives ou inexactes**. Nous ne garantissons ni leur exactitude ni leur exhaustivité.
- Le **NeoBase Score est notre propre indicateur éditorial**, calculé à partir des données décrites ci-dessus. Ce n'est pas une notation officielle et il n'est pas approuvé par les marques qu'il décrit.
- Rien dans le Service ne constitue un **conseil en investissement, financier, juridique ou fiscal**, ni une recommandation d'utiliser, d'acheter ou de vendre un produit ou service. Les décisions que vous prenez sur la base du Service relèvent de votre seule responsabilité.

## 4. Comptes

Certaines fonctionnalités nécessitent un compte. Nous utilisons une connexion sans mot de passe : vous saisissez votre e-mail et recevez un lien de connexion à usage unique. Vous êtes responsable de la sécurité de l'accès à votre messagerie et de l'activité sur votre compte. Vous pouvez fermer votre compte à tout moment en écrivant à ${CONTACT_EMAIL}.

## 5. Services payants

Les offres payantes (par ex. surveillance, rapports) - lorsqu'elles sont proposées - sont décrites au moment de l'achat, y compris le prix et la période de facturation. Les paiements sont traités par notre prestataire de paiement ; ses conditions s'appliquent à la transaction. Les droits légaux de rétractation des consommateurs s'appliquent lorsque la loi l'exige ; les détails sont fournis au moment du paiement.

## 6. Utilisation acceptable

Vous vous engagez à ne pas : utiliser le Service de manière illicite ; extraire (scraping), télécharger en masse ou extraire systématiquement des données autrement que via les interfaces que nous fournissons ; perturber ou sonder la sécurité du Service ; présenter le NeoBase Score comme une notation officielle ; ou porter atteinte à nos droits ou à ceux de tiers.

## 7. Propriété intellectuelle

Le Service, son design, ses textes ainsi que la méthodologie et les résultats du NeoBase Score sont protégés par la loi. Les notes et marques tierces sous-jacentes appartiennent à leurs titulaires respectifs. Vous pouvez partager et créer des liens vers nos pages à des fins non commerciales avec attribution ; toute autre utilisation requiert notre consentement.

## 8. Responsabilité

Dans toute la mesure permise par la loi, nous ne sommes pas responsables des décisions prises en se fiant au Service, de l'exactitude des données de tiers, ni des dommages indirects ou consécutifs. Rien dans les présentes ne limite une responsabilité qui ne peut être limitée par la loi (y compris envers les consommateurs).

## 9. Réclamations

Vous pouvez déposer une réclamation à ${CONTACT_EMAIL}. Nous nous efforçons de répondre sous 14 jours.

## 10. Modifications

Nous pouvons mettre à jour ces Conditions ; la date de « dernière mise à jour » indique la version en vigueur. Les modifications substantielles concernant les utilisateurs enregistrés seront communiquées par e-mail ou dans le Service.

## 11. Droit applicable

Les présentes Conditions sont régies par le droit polonais et le droit applicable de l'UE, sans préjudice des règles impératives de protection des consommateurs de votre pays de résidence. Les litiges relèvent des tribunaux compétents, sous réserve des droits légaux des consommateurs.

## 12. Contact

${OPERATOR} - ${CONTACT_EMAIL}.
`;

const PRIVACY_FR = `# Politique de confidentialité

_Dernière mise à jour : ${LEGAL_UPDATED}_

Cette politique explique comment nous traitons les données personnelles au titre du RGPD (Règlement (UE) 2016/679).

## 1. Responsable du traitement

Le responsable du traitement de vos données personnelles est ${OPERATOR}, ${REG.fr}. Contact : ${CONTACT_EMAIL}.

## 2. Ce que nous collectons

- **Adresse e-mail** - lorsque vous vous connectez (lien magique sans mot de passe) ou demandez un rapport. C'est la seule donnée identifiante que nous vous demandons.
- **Données techniques** - journaux de serveur standard (adresse IP, agent utilisateur, horodatages) générés lors de votre visite, utilisés pour la sécurité et la fiabilité.
- **Cookies et analyse** - un cookie de session essentiel vous maintient connecté. Avec votre consentement, nous utilisons aussi Google Analytics 4, qui dépose des cookies et collecte des données d'usage agrégées (pages vues, localisation approximative) afin d'améliorer le Service.

Nous ne collectons **pas** de catégories particulières de données, et les données de marques/avis du Service concernent des entreprises, pas vous.

## 3. Finalités et bases légales

- Fourniture du Service et de votre compte - art. 6, §1, b (exécution d'un contrat).
- Sécurité, prévention des abus et fiabilité du Service - art. 6, §1, f (intérêt légitime).
- Envoi d'un rapport que vous avez demandé et suivi associé - art. 6, §1, b/a (contrat / consentement, que vous pouvez retirer à tout moment).

## 4. Destinataires / sous-traitants

Nous faisons appel à des sous-traitants vérifiés qui agissent sur nos instructions :

- **Fournisseurs d'hébergement et d'infrastructure cloud** - hébergement, distribution et stockage de base de données du Service, dans l'UE/EEE ou avec des garanties appropriées.
- **Google (Google Analytics 4)** - analyse d'audience du site, chargée uniquement avec votre consentement.
- **Cybot A/S (Cookiebot)** - gestion du consentement aux cookies.
- **Resend** - envoi d'e-mails transactionnels (liens de connexion, rapports demandés).

Les services fournissant des **données publiques sur les marques** (par ex. Apify, DataForSEO) ainsi que notre fournisseur d'IA traitent des informations sur les marques, pas vos données personnelles.

## 5. Transferts hors de l'EEE

Certains sous-traitants sont situés aux États-Unis. Ces transferts reposent sur des garanties appropriées au titre du RGPD (par ex. clauses contractuelles types et, le cas échéant, le cadre de protection des données UE-États-Unis).

## 6. Conservation

Nous conservons les données de compte tant que votre compte existe et les supprimons à sa fermeture. Les données de demande de rapport ne sont conservées que le temps nécessaire au traitement de la demande et pendant une période raisonnable de suivi. Les journaux de serveur sont conservés pour une durée limitée à des fins de sécurité.

## 7. Vos droits

Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité, ainsi que du droit de retirer votre consentement à tout moment. Pour les exercer, écrivez à ${CONTACT_EMAIL}. Vous avez également le droit d'introduire une réclamation auprès d'une autorité de contrôle - en Pologne, le Président de l'Office de protection des données personnelles (**PUODO**), ul. Stawki 2, 00-193 Varsovie.

## 8. Cookies

Un cookie de session **strictement nécessaire** vous maintient connecté et est toujours actif. Nous utilisons également **Google Analytics 4** pour comprendre comment le Service est utilisé ; ses cookies d'analyse ne sont déposés qu'après votre consentement. Le consentement pour les cookies non essentiels est recueilli et géré via **Cookiebot**, et vous pouvez le modifier ou le retirer à tout moment dans les paramètres des cookies.

## 9. Modifications

Nous pouvons mettre à jour cette politique ; la date de « dernière mise à jour » indique la version en vigueur. Les modifications substantielles seront communiquées aux utilisateurs enregistrés.

## 10. Contact

Questions sur cette politique : ${CONTACT_EMAIL}.
`;

const TERMS: Record<string, string> = { en: TERMS_EN, pl: TERMS_PL, de: TERMS_DE, es: TERMS_ES, fr: TERMS_FR };
const PRIVACY: Record<string, string> = { en: PRIVACY_EN, pl: PRIVACY_PL, de: PRIVACY_DE, es: PRIVACY_ES, fr: PRIVACY_FR };

/**
 * Markdown body for a legal document in the requested locale. `localized` is
 * false when we fell back to English (should not happen for the five indexable
 * locales, all of which are authored/translated above).
 */
export function getLegal(kind: LegalKind, locale: string): { body: string; localized: boolean } {
  const map = kind === "terms" ? TERMS : PRIVACY;
  const body = map[locale] ?? map[routing.defaultLocale];
  return { body, localized: map[locale] != null };
}
