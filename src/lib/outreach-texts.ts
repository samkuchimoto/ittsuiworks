/**
 * The outreach emails, word for word. Nothing is sent until Samuel approves these texts and sets OUTREACH_LIVE=on.
 * Short on purpose. No "Re:" subjects, no promises, no figures. Every email names the sender, gives a postal address
 * (CAN-SPAM, 特定電子メール法) and a way to stop: in English "reply STOP" (Samuel's text, 15 November 2026; a reply
 * marks the company replied, so nothing more is sent), plus the one-click List-Unsubscribe header on every email.
 * Values: {company} {trade} {country} {postJob} {companies} {domain} {email} {address} {unsubscribe}
 */
export const OUTREACH_TEXTS = {
  en: {
    steps: [
      {
        // Samuel, 15 November 2026: "Use this version." Word for word.
        subject: "HVAC, electrician and project leads",
        lines: [
          "Hello {company} team,",
          "",
          "Ittsui Works sends you HVAC, electrician, data center and marine clients who already have budget and a start date. You only pay for the leads you take.",
          "",
          "Start here: https://ittsuiworks.com",
          "",
          "Ittsui Works Team",
        ],
      },
      {
        subject: "{company}: hiring technicians?",
        lines: ["Hello again,", "A job posted on Ittsui Works is live in minutes, on its own page built for Google's job search:", "{postJob}"],
      },
      {
        subject: "{trade} project requests in {country}",
        lines: ["Hello,", "Facility owners and builders post {trade} projects on Ittsui Works, and companies in the trade take the leads they want. Sign up here:", "{companies}"],
      },
    ],
    footer: [
      "",
      "--",
      "Ittsui Works is operated by Kuchimoto LLC, 30 N Gould St, Ste R, Sheridan, WY 82801, USA.",
      "To unsubscribe, reply STOP.",
    ],
    tradeNames: { hvac: "HVAC", datacenter: "Data center", marine: "Marine" },
  },
  ja: {
    steps: [
      {
        subject: "技術者の求人掲載と案件のご案内｜一対ワークス",
        lines: [
          "{company} ご担当者様",
          "一対ワークスは、業務用空調・データセンター・船舶の会社向けに、技術者の求人を掲載し、案件のご相談をお届けするサービスです。費用は、お受けになる案件の分だけです。",
          "求人を掲載する：{postJob}",
          "案件を受け取る：{companies}",
        ],
      },
      {
        subject: "{company} 様：技術者の採用について",
        lines: ["{company} ご担当者様", "一対ワークスに掲載した求人は、数分で公開されます。Google のしごと検索に対応した専用ページができます。", "{postJob}"],
      },
      {
        subject: "{country}の{trade}案件のご案内",
        lines: ["{company} ご担当者様", "一対ワークスでは、施設のオーナーや建設会社が{trade}の案件を掲載し、専門会社が希望する案件をお受けしています。ご登録はこちらから。", "{companies}"],
      },
    ],
    footer: [
      "",
      "送信者：一対ワークス（運営：Kuchimoto LLC）",
      "住所：{address}",
      "お問い合わせ：contact@ittsuiworks.com",
      "{domain} に掲載されている {email} にお送りしています。配信停止：{unsubscribe}",
    ],
    tradeNames: { hvac: "空調", datacenter: "データセンター", marine: "船舶" },
  },
} as const;

/**
 * Lead in hand: one real open project, offered to a company on the outreach list (config.ts OUTREACH.leadInHand).
 * Drafted 15 November 2026. NOT SENT until Samuel approves these words and OUTREACH_LEAD_OFFERS=on is set in Vercel.
 * Same footer as above. Values: {company} {trade} {title} {place} {budget} {start} {price} {link}
 */
export const LEAD_IN_HAND_TEXTS = {
  en: {
    subject: "{trade} project in {place}",
    lines: [
      "Hello {company} team,",
      "",
      "A client posted this project on Ittsui Works:",
      "",
      "{title}",
      "Place: {place}",
      "Size: {budget}",
      "Start: {start}",
      "",
      "Take it for {price} and get the client's contact details at once. Three companies at most:",
      "{link}",
      "",
      "Ittsui Works Team",
    ],
  },
  ja: {
    subject: "{place}の{trade}案件のご案内",
    lines: [
      "{company} ご担当者様",
      "一対ワークスに、次の案件が掲載されました。",
      "{title}",
      "場所：{place}",
      "規模：{budget}",
      "開始：{start}",
      "{price}でお受けいただくと、依頼者の連絡先がすぐに届きます。お受けいただけるのは3社までです。",
      "{link}",
    ],
  },
} as const;

/**
 * Facility operators (data centers found on PeeringDB and OpenStreetMap) buy cooling and power work, so they get the
 * buyer side: post a project. Step 2 is the approved hiring email above, word for word.
 * Drafted 15 November 2026. NOT SENT until Samuel approves these words and OUTREACH_OPERATORS=on is set in Vercel;
 * until then operators get no email at all (never the contractor email).
 * Same footer as above. Values: as above, plus {postProject}
 */
export const OPERATOR_TEXTS = {
  en: {
    steps: [
      {
        subject: "HVAC and electrical contractors for {company}",
        lines: [
          "Hello {company} team,",
          "",
          "Post your cooling, power or fit-out work on Ittsui Works. HVAC and electrical companies in your country get it, and up to three of them can take it and contact you.",
          "",
          "Post a project: {postProject}",
          "",
          "Ittsui Works Team",
        ],
      },
      OUTREACH_TEXTS.en.steps[1],
      {
        subject: "Cooling and power work at {company}?",
        lines: ["Hello,", "One short form: HVAC and electrical companies in your country see your project, and three at most take it:", "{postProject}"],
      },
    ],
  },
  ja: {
    steps: [
      {
        subject: "空調・電気工事の専門会社をお探しの際に｜一対ワークス",
        lines: [
          "{company} ご担当者様",
          "一対ワークスに冷却・電源・内装工事の案件を掲載いただくと、{country}の空調・電気工事会社に届き、最大3社が案件をお受けして直接ご連絡します。",
          "案件を掲載する：{postProject}",
        ],
      },
      OUTREACH_TEXTS.ja.steps[1],
      {
        subject: "{company} 様：冷却・電源工事のご相談",
        lines: ["{company} ご担当者様", "短いフォームひとつで、{country}の空調・電気工事会社に案件が届きます。お受けするのは最大3社です。", "{postProject}"],
      },
    ],
  },
} as const;
