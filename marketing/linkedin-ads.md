# LinkedIn ads: first test campaign

The goal is to **learn, not to scale**. With a budget of about €150 to €200 over two weeks, find out:

1. what a lead costs, and
2. which message works better: pain or story.

## Before you start

- **A LinkedIn Company Page is required.** Every LinkedIn ad runs from one, so create a free page if you don't have one. Name it after you or the project, e.g. "Side Hustle Germany".
- **Campaign Manager:** linkedin.com/campaignmanager. Create an ad account, set the currency to EUR and add a card.
- **Don't install the LinkedIn Insight Tag.** It sets cookies, which would bring back the consent banner. You don't need it: the site records UTM tags itself, and the results appear under **Campaigns and ads** in `/admin`.

## The settings, explained

| Setting | What it means | Choose |
|---|---|---|
| **Objective** | What LinkedIn optimises for. "Website visits" gets clicks to your page. "Lead generation" uses a form inside LinkedIn. "Website conversions" needs the Insight Tag. | **Website visits** |
| **Audience: location** | "People in or recently in" a place. | **Germany** |
| **Audience: profile language** | The language of the person's LinkedIn interface. English here is a good filter for expats, who are your readers. | **English** |
| **Audience: extras** | Job function, seniority, skills, etc. Leave them empty at first; the location and language filters are already narrow. | none, for test 1 |
| **Audience Expansion** | LinkedIn widens your audience to "similar" people. That muddies the test. | **Off** |
| **LinkedIn Audience Network** | Shows the ad on partner apps and sites outside LinkedIn. Clicks are cheap but low quality. | **Off** |
| **Ad format** | Single image, carousel, video, document, text, Thought Leader (boost a personal post). | **Single image** (simplest), see "Option B" below |
| **Bidding** | "Maximum delivery" lets LinkedIn spend the budget however it wants. "Manual bidding" sets the most you'll pay per click. | **Manual CPC**, start at LinkedIn's lowest suggested bid |
| **Budget** | Daily budget, plus an end date. LinkedIn's minimum is about €10/day. | **€10–15/day, 10–14 days** |

The audience size should land roughly between 50k and 300k. If it's much smaller, delivery will be slow and expensive.

## How to split the test

Use **one campaign group** containing **two campaigns**. Give both the same audience and budget, and **one ad each**. LinkedIn tends to push spend to whichever ad it likes early on, so two separate campaigns give each message the same chance.

| Campaign | Ad | Link |
|---|---|---|
| `li-test-1-pain` | Pain ad (below) | `https://stack-crate.com/?utm_source=linkedin&utm_medium=paid&utm_campaign=li-test-1&utm_content=pain` |
| `li-test-1-story` | Story ad (below) | `https://stack-crate.com/?utm_source=linkedin&utm_medium=paid&utm_campaign=li-test-1&utm_content=story` |

(Swap in the real domain if it isn't stack-crate.com.)

Note: the landing page still runs its own A/B test on the headline, so there are two tests going at once. That's fine: the `utm_content` column shows which ad brought people in, and the variant table shows which landing page converted them.

## Ad copy

**Pain ad**

- Intro text: "Registering a company in Germany took us 4 months and €606 in fees: notary, Handelsregister, Gewerbeamt, Finanzamt, all in German. I wrote down every step, in order, with what it cost and how long it took. Free 7-page checklist and guide, in plain English."
- Headline: "Start your side hustle in Germany without drowning in paperwork"
- CTA button: **Download**

**Story ad**

- Intro text: "I'm Canadian. When my co-founder and I registered our company in Germany, nobody told us the real order of steps, the real costs, or the VAT decision we should have made first. So I wrote the 7-page checklist and guide I wish I'd had."
- Headline: "The checklist I wish I had when registering a company in Germany"
- CTA button: **Download**

**Image:** a photo of you, or a mock-up of the PDF's first page with "€606 · 4 months" on it. Use 1200×627 or square 1200×1200. Ads with a real face usually beat stock images.

## Metrics: what they mean and what to look at

| Metric | Where | Meaning | Rough guide (B2C-ish audience in Germany, varies a lot) |
|---|---|---|---|
| Impressions | LinkedIn | Times the ad was shown | — |
| CTR | LinkedIn | Clicks ÷ impressions: does the ad grab attention? | 0.4–0.6% is typical for single image; above 1% is great |
| CPC | LinkedIn | Cost per click | often €3–10 in Germany |
| Visitors | `/admin` | People who actually loaded the page (LinkedIn clicks are always higher than this) | — |
| Conversion | `/admin` | Leads ÷ visitors: does the page persuade? | 20–40% is healthy for a free PDF |
| **Cost per lead** | spend ÷ leads | **The number that matters** | Compare it with what a subscriber is worth to you |
| Subscribed | `/admin` | Leads who ticked the newsletter box: real demand for more content | — |

**How to read the results:**

- **Low CTR:** the ad isn't working. Change the image or the first line.
- **Good CTR, low conversion:** the page isn't working, or the ad promises something the page doesn't deliver.
- **Don't judge before each ad has about 100 clicks.** With €150 you may only get 20–50 clicks in total, so treat the result as a hint, not proof.

## Option B: Thought Leader Ads (boost one of your own posts)

If one of your organic LinkedIn posts already did well, you can promote it as a **Thought Leader Ad**. It shows as a normal post from you rather than an ad from a company page, and often gets cheaper engagement.

- It still needs a Company Page, and you must link your profile to it.
- The link has to be in the post. Edit the post so it uses a UTM link like the ones above, with `utm_content=organic-boost`.

## Cheaper alternatives to try after this

LinkedIn is one of the most expensive ad networks. If the cost per lead is too high, try one of these with the same UTM scheme:

- **Reddit:** r/germany, r/expats, r/berlin and similar.
- **Meta (Facebook/Instagram):** target people in Germany who speak English and are interested in entrepreneurship.

## Tagging organic posts from now on

The site now records the referring website, so most of today's organic traffic shows up by source automatically. In-app browsers (the LinkedIn, X and YouTube apps) often hide the referrer, and those visits show as "direct". For new posts, tag the links:

```
?utm_source=hackernews&utm_medium=social
?utm_source=linkedin&utm_medium=social
?utm_source=youtube&utm_medium=video
?utm_source=threads&utm_medium=social
?utm_source=substack&utm_medium=social
?utm_source=x&utm_medium=social
```

You can also edit the links in posts you've already published.
