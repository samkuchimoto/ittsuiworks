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
        subject: "HVAC, electrician and project leads, free to start",
        lines: [
          "Hello {company} team,",
          "",
          "Ittsui Works sends you HVAC, electrician, data center and marine clients who already have budget and a start date. You only pay for the leads you take.",
          "",
          "Free to start: https://ittsuiworks.com",
          "",
          "Ittsui Works Team",
        ],
      },
      {
        subject: "{company}: hiring technicians?",
        lines: ["Hello again,", "A job posted on Ittsui Works is free and live in minutes, on its own page built for Google's job search:", "{postJob}"],
      },
      {
        subject: "{trade} project requests in {country}",
        lines: ["Hello,", "Facility owners and builders post {trade} projects on Ittsui Works, and companies in the trade take the leads they want. Signing up is free:", "{companies}"],
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
        subject: "技術者の求人掲載（無料）と案件のご案内｜一対ワークス",
        lines: [
          "{company} ご担当者様",
          "一対ワークスは、業務用空調・データセンター・船舶の会社向けに、技術者の求人を無料で掲載し、案件のご相談をお届けするサービスです。費用は、お受けになる案件の分だけです。",
          "求人を掲載する：{postJob}",
          "案件を受け取る：{companies}",
        ],
      },
      {
        subject: "{company} 様：技術者の採用について",
        lines: ["{company} ご担当者様", "一対ワークスへの求人掲載は無料で、数分で公開されます。Google のしごと検索に対応した専用ページができます。", "{postJob}"],
      },
      {
        subject: "{country}の{trade}案件のご案内",
        lines: ["{company} ご担当者様", "一対ワークスでは、施設のオーナーや建設会社が{trade}の案件を掲載し、専門会社が希望する案件をお受けしています。登録は無料です。", "{companies}"],
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
