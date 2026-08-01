/**
 * The social campaign kit: ready-to-post copy and the asset manifest behind
 * /admin/socialmedia.
 *
 * Plain data, no dependencies, so the claims can be unit-tested. That matters
 * more here than it looks: these strings go out under Freehold's name into
 * groups full of people who will hold us to them, so a post promising
 * something the product doesn't do is a support problem and a credibility
 * problem at once. The tests check the promises stay in step with the
 * homepage's (free tier, $40, 30-day onboarding, live phone support).
 */

export type PostLength = "short" | "long";

/**
 * Who is speaking. The founder posts are first person and only work coming
 * from Paul; the company posts are what a sales rep can put in a group under
 * the brand's name without pretending to have built the thing.
 */
export type PostVoice = "founder" | "company";

export interface SocialPost {
  id: string;
  /** Where this one is aimed. Groups have different tolerances for a pitch. */
  audience: "Facebook group" | "Facebook page" | "YouTube" | "Anywhere";
  length: PostLength;
  voice: PostVoice;
  /** What the post is for, shown as a chip so Paul can scan the list. */
  angle: string;
  body: string;
  /** Which asset to attach, by file name in /marketing/social. */
  suggestedAsset?: string;
}

const SITE = "freeholdtc.dev";

export const SOCIAL_POSTS: SocialPost[] = [
  // --- Short: one or two lines, for dropping into a group thread ----------
  {
    id: "s1",
    voice: "founder",
    audience: "Facebook group",
    length: "short",
    angle: "Intro",
    body: `I built a transaction management system for TCs, and the free plan covers your first 5 closings with no credit card. Would love a few honest opinions: ${SITE}`,
    suggestedAsset: "shot-dashboard.png",
  },
  {
    id: "s2",
    voice: "founder",
    audience: "Facebook group",
    length: "short",
    angle: "Client portal",
    body: `Your client gets one link and can see exactly where their closing stands, any time. No more "any update?" texts on a Sunday. ${SITE}`,
    suggestedAsset: "shot-client-portal.png",
  },
  {
    id: "s3",
    voice: "founder",
    audience: "Anywhere",
    length: "short",
    angle: "Contract reading",
    body: `Upload the purchase contract and the dates, deadlines, and people come out of it for you. You check the work; it does the typing. ${SITE}`,
    suggestedAsset: "card-contract.png",
  },
  {
    id: "s4",
    voice: "founder",
    audience: "Facebook group",
    length: "short",
    angle: "Price",
    body: `$40 a month, everything included, AI and all. No per-transaction fees, no add-ons, no annual contract. ${SITE}`,
    suggestedAsset: "card-price.png",
  },
  {
    id: "s5",
    voice: "founder",
    audience: "Anywhere",
    length: "short",
    angle: "Support",
    body: `Support is a real phone number and live chat. A person answers. That shouldn't be a feature in 2026, but here we are. ${SITE}`,
  },
  {
    id: "s6",
    voice: "founder",
    audience: "Facebook group",
    length: "short",
    angle: "Onboarding",
    body: `Every new account gets 30 days of onboarding help at no charge, including moving you off whatever you're using now. ${SITE}`,
  },
  {
    id: "s7",
    voice: "founder",
    audience: "Anywhere",
    length: "short",
    angle: "Voice search",
    body: `Ask "what's closing this week?" out loud and it answers from your own files, then takes you to the right page. ${SITE}`,
    suggestedAsset: "shot-voice.png",
  },
  {
    id: "s8",
    voice: "founder",
    audience: "Facebook group",
    length: "short",
    angle: "Try it",
    body: `There's a live demo with sample data. No sign-up, no email, nothing to cancel. Just click around: ${SITE}/demo`,
    suggestedAsset: "shot-transactions.png",
  },
  {
    id: "s9",
    voice: "founder",
    audience: "Anywhere",
    length: "short",
    angle: "Templates",
    body: `Checklists, email templates, intake forms, document templates. All included, and there's a starter library so you're not building from a blank page. ${SITE}`,
    suggestedAsset: "shot-templates.png",
  },
  {
    id: "s10",
    voice: "founder",
    audience: "Facebook page",
    length: "short",
    angle: "Branding",
    body: `Pick your colour once and your dashboard, your emails, and your client portals all match. It looks like your business, because it is. ${SITE}`,
    suggestedAsset: "shot-themes.png",
  },
  {
    id: "s11",
    voice: "founder",
    audience: "Anywhere",
    length: "short",
    angle: "PDFs",
    body: `Split a 40-page scan into its documents, combine files into a closing package, and email any of them out. All without leaving the file. ${SITE}`,
    suggestedAsset: "shot-attachments.png",
  },
  {
    id: "s12",
    voice: "founder",
    audience: "Facebook group",
    length: "short",
    angle: "Intake",
    body: `Give your agents an intake form and new business arrives already organised, instead of as a text message at 9pm. ${SITE}`,
    suggestedAsset: "shot-intake-form.png",
  },

  // --- Long: for a post that earns its place in a group -------------------
  {
    id: "l1",
    voice: "founder",
    audience: "Facebook group",
    length: "long",
    angle: "Founder intro",
    body: `Hi everyone. I've spent the last stretch building a transaction management system specifically for TCs, and I'd rather hear from people who do this work every day than guess.

The short version: every closing lives on one page, your clients follow along on a portal with your name on it, and the AI reads the purchase contract so you're not retyping dates that are already in the PDF. Email you send goes out from the file, and replies come back to it.

The free plan covers 2 users and 5 active closings, no credit card. If you outgrow it, it's $40 a month with everything included: the AI, the portals, the templates, and support.

There's a live demo with sample data, no sign-up at all, if you just want to click around: ${SITE}/demo

Genuinely after honest feedback, including the parts you'd hate.`,
    suggestedAsset: "shot-dashboard.png",
  },
  {
    id: "l2",
    voice: "founder",
    audience: "Facebook group",
    length: "long",
    angle: "Client experience",
    body: `The part of this job nobody sees is how much of it is reassurance.

Buyers text at odd hours because they don't know what's happening, not because anything is wrong. Agents chase you for updates they'd never need if they could just look.

So the system I built gives each client and each agent a link. They open it and see exactly where the closing stands: what's done, what's next, the dates, and the documents you chose to share. It updates itself as you work, so it's never stale, and it carries your name and your colours rather than some vendor's.

The calls don't stop entirely. But they change from "what's going on?" to actual questions, which is a much better use of everyone's afternoon.

Free for your first 5 closings if you want to try it on a real file: ${SITE}`,
    suggestedAsset: "shot-client-portal.png",
  },
  {
    id: "l3",
    voice: "founder",
    audience: "Facebook group",
    length: "long",
    angle: "Data entry",
    body: `A question I got asked a lot while building this: how much of your day is typing things that are already written down somewhere?

The contract has the closing date. It has the inspection deadline, the financing contingency, the earnest money amount, the names, and the agents. And then someone types all of it into a spreadsheet or a system, by hand, on every single file.

Freehold reads the contract and pulls those out for you, including the relative ones like "ten days from the Effective Date". Every value shows you the page it came from, and nothing is saved until you approve it. The AI never gets the last word.

It's included in the price on every paid plan. No API keys, no usage meters, no separate AI subscription.

${SITE}`,
    suggestedAsset: "card-contract.png",
  },
  {
    id: "l4",
    voice: "founder",
    audience: "Facebook group",
    length: "long",
    angle: "Switching",
    body: `If you're on a TC platform you don't love, the thing stopping you is usually not the software. It's the thought of moving.

So here's how switching actually goes: you run your in-flight closings to the finish line where they are, and open new ones in the new system. Nothing gets disrupted mid-deal. Within a few weeks the old system is empty and you cancel it.

We include 30 days of onboarding at no charge, and that includes helping you move. Your templates, your checklists, your contacts.

And if you ever want to leave us, you download everything, records and documents, in one file, any time, on any plan. No waiting period and no phone call.

Free to start, no credit card: ${SITE}`,
  },
  {
    id: "l5",
    voice: "founder",
    audience: "Facebook page",
    length: "long",
    angle: "What's included",
    body: `What you get for $40 a month, in plain terms:

Every closing on one page, with its dates, its checklist, its documents, and everyone involved.

Client and agent portals, so the people in your deal can see where things stand without asking you.

AI that reads the purchase contract and fills the file in, and voice search that answers questions about your own files out loud. Both included, no extra charge, no usage meters.

Email that sends from the file and files the replies back onto it. Templates for checklists, emails, intake forms, and documents, with a starter library included.

PDF tools: split a scan, combine a closing package, email any document in a couple of clicks.

Support on a real phone number, and 30 days of onboarding help when you start.

Start free, 5 active closings, no credit card: ${SITE}`,
    suggestedAsset: "cover-facebook.png",
  },
  {
    id: "l6",
    voice: "founder",
    audience: "Facebook group",
    length: "long",
    angle: "Ask for feedback",
    body: `Building software for a job you don't do yourself is how you end up with something that demos beautifully and is miserable on a Tuesday.

So I'm asking: what's the part of your week that software has never once helped with?

Not the big obvious stuff. The small grinding thing. Chasing the same document for the fourth time. Explaining to a buyer what a title commitment is. Rebuilding the same checklist from scratch on every file.

I've built what I think is a good answer to a lot of it, and there's a demo with sample data you can poke at without signing up: ${SITE}/demo

But I'd rather hear the thing I've missed.`,
  },
  {
    id: "l7",
    voice: "founder",
    audience: "YouTube",
    length: "long",
    angle: "Video description",
    body: `A short walkthrough of Freehold, transaction management built for coordinators.

In this video: your day at a glance, every closing in one list, and what a single file looks like when the dates, the checklist, the documents, and the people all live on one page.

Freehold includes AI that reads the purchase contract and fills in the file, client portals your clients can follow, email that sends from the file and files the replies, and a full template library. All of it is in one monthly price, with no usage meters.

Start free with 5 active closings and no credit card: https://${SITE}
Try the live demo, no sign-up required: https://${SITE}/demo

Chapters:
0:00 Your day at a glance
0:07 Every closing in one list
0:13 Inside a single file`,
  },
  {
    id: "l8",
    voice: "founder",
    audience: "Anywhere",
    length: "long",
    angle: "Independent TCs",
    body: `Something I keep hearing from independent TCs: the tools are either built for a brokerage with an IT department, or they're a spreadsheet with ambitions.

If you're running your own book of business, you need the professional surface without the enterprise overhead. Clients who feel looked after. Agents who send you more work because you make them look good. And a system that doesn't need a consultant to set up.

Freehold is that. Sign up, upload a contract, and you're working. Your first 30 days include onboarding help from a real person, and support is a phone number, not a ticket queue.

Free for your first 5 closings, no credit card: ${SITE}

And there's a free listing on FindTCPros.com with every paid account, where agents go looking for a coordinator.`,
    suggestedAsset: "card-portal.png",
  },

  // --- Company voice: for a sales rep posting under the brand's name -----
  // Same claims, no first-person authorship. A rep saying "I built this"
  // is the one thing that would make the whole account read as fake.
  {
    id: "c1",
    voice: "company",
    audience: "Facebook group",
    length: "short",
    angle: "Intro",
    body: `Freehold is transaction management built specifically for coordinators. Every closing on one page, and a free plan that covers your first 5, no credit card: ${SITE}`,
    suggestedAsset: "shot-dashboard.png",
  },
  {
    id: "c2",
    voice: "company",
    audience: "Anywhere",
    length: "short",
    angle: "Client portal",
    body: `At Freehold, we think a client should never have to ask where their closing stands. Every deal comes with a portal they can check any time: ${SITE}`,
    suggestedAsset: "shot-client-portal.png",
  },
  {
    id: "c3",
    voice: "company",
    audience: "Facebook group",
    length: "short",
    angle: "Contract reading",
    body: `Freehold reads the purchase contract and fills the file in for you: the dates, the deadlines, the people. You approve it; it does the typing. ${SITE}`,
    suggestedAsset: "card-contract.png",
  },
  {
    id: "c4",
    voice: "company",
    audience: "Facebook page",
    length: "short",
    angle: "Price",
    body: `One price, everything in it. Freehold is $40 a month with the AI, the portals, the templates, and support included. No per-transaction fees: ${SITE}`,
    suggestedAsset: "card-price.png",
  },
  {
    id: "c5",
    voice: "company",
    audience: "Anywhere",
    length: "short",
    angle: "Support",
    body: `Freehold customers get a real phone number and live chat. No voicemail, no ticket queue. You call, a person answers: ${SITE}`,
  },
  {
    id: "c6",
    voice: "company",
    audience: "Facebook group",
    length: "short",
    angle: "Onboarding",
    body: `Every new Freehold account includes 30 days of onboarding at no charge, and that covers moving you off your current system: ${SITE}`,
  },
  {
    id: "c7",
    voice: "company",
    audience: "Anywhere",
    length: "short",
    angle: "Voice search",
    body: `Ask Freehold what's closing this week and it answers out loud, from your own files, then opens the right page: ${SITE}`,
    suggestedAsset: "shot-voice.png",
  },
  {
    id: "c8",
    voice: "company",
    audience: "Facebook group",
    length: "short",
    angle: "Try it",
    body: `You can try Freehold right now with sample data. No sign-up, no email, nothing to cancel: ${SITE}/demo`,
    suggestedAsset: "shot-transactions.png",
  },
  {
    id: "c9",
    voice: "company",
    audience: "Anywhere",
    length: "short",
    angle: "Templates",
    body: `Checklists, emails, intake forms, and document templates all come with Freehold, along with a starter library so nobody begins from a blank page: ${SITE}`,
    suggestedAsset: "shot-templates.png",
  },
  {
    id: "c10",
    voice: "company",
    audience: "Facebook page",
    length: "short",
    angle: "Branding",
    body: `Your dashboard, your emails, and your client portals all carry your colours. Freehold looks like your business, because it is: ${SITE}`,
    suggestedAsset: "shot-themes.png",
  },
  {
    id: "c11",
    voice: "company",
    audience: "Anywhere",
    length: "short",
    angle: "Agents",
    body: `Give every agent you work with a link to the deal. Freehold keeps it current, so the "any update?" calls stop coming: ${SITE}`,
    suggestedAsset: "shot-client-portal.png",
  },
  {
    id: "c12",
    voice: "company",
    audience: "Facebook group",
    length: "short",
    angle: "Free listing",
    body: `Every paid Freehold account includes a free listing on FindTCPros.com, where agents go looking for a coordinator: ${SITE}`,
  },

  // Company voice, longer.
  {
    id: "cl1",
    voice: "company",
    audience: "Facebook group",
    length: "long",
    angle: "Relationships",
    body: `At Freehold, we know how important relationships are in this business. A coordinator's reputation is built on how people feel working with them, not on how many boxes got ticked.

That is why we built Freehold around communication first. Your clients get a portal with your name on it, showing exactly where their closing stands, updated as you work. Your agents get the same, so they stop calling for updates and start sending you referrals. Every email you send goes out from the file, and every reply comes back to it, so the whole story of a deal stays in one place.

The rest of it is there too: AI that reads the purchase contract and fills in the file, templates for everything, PDF tools, and a full CRM. All in one monthly price.

Free for your first 5 closings, no credit card: ${SITE}`,
    suggestedAsset: "card-portal.png",
  },
  {
    id: "cl2",
    voice: "company",
    audience: "Facebook page",
    length: "long",
    angle: "What it is",
    body: `Freehold is transaction management built for the people who actually run closings.

Every deal lives on one page: its dates, its checklist, its documents, and everyone involved. Upload the purchase contract and Freehold reads it, pulling out the deadlines and the parties so nobody retypes what the PDF already says. Nothing is saved until you approve it.

Your clients and agents follow along on portals you control. Your emails send from the file and file themselves back onto it. Your checklists, email templates, intake forms, and document templates are all included, with a starter library to build from.

Support is a real phone number answered by a person, and every new account gets 30 days of onboarding help at no charge.

$40 a month with everything in it, or free for your first 5 active closings: ${SITE}`,
    suggestedAsset: "cover-facebook.png",
  },
  {
    id: "cl3",
    voice: "company",
    audience: "Facebook group",
    length: "long",
    angle: "Switching",
    body: `Thinking about switching transaction management systems but dreading the move?

Here is how it goes with Freehold. You finish your in-flight closings where they are and open new ones in Freehold. Nothing gets disrupted mid-deal. Within a few weeks the old system is empty and you cancel it.

Your first 30 days include onboarding at no charge, and that includes helping you bring over your templates, your checklists, and your contacts. A real person walks you through it.

And if Freehold ever stops being right for you, you download everything, records and documents, in one file, any time, on any plan. No waiting period and no phone call to cancel.

Start free with 5 active closings, no credit card: ${SITE}`,
  },
  {
    id: "cl4",
    voice: "company",
    audience: "Anywhere",
    length: "long",
    angle: "AI included",
    body: `Every Freehold plan includes AI, at no extra charge and with no usage meters.

That means the purchase contract gets read for you, with the dates, deadlines, and parties pulled out and shown with the page they came from. It means you can ask a question about your own files out loud and get an answer. It means the busywork that used to eat a morning is checked rather than typed.

We think charging separately for that would be strange. It is part of the product, so it is part of the price.

Freehold is $40 a month with everything included, and free for your first 5 active closings: ${SITE}`,
    suggestedAsset: "card-contract.png",
  },
];

/** Every asset shipped with the kit, grouped for the page. */
export interface AssetGroup {
  title: string;
  note: string;
  /** Files live in /marketing/social/. */
  items: { file: string; label: string; size?: string }[];
}

export const ASSET_GROUPS: AssetGroup[] = [
  {
    title: "Covers and profile",
    note: "Sized for each platform's own recommendation. Upload as-is.",
    items: [
      { file: "cover-facebook.png", label: "Facebook page cover", size: "1640 x 624" },
      { file: "cover-youtube.png", label: "YouTube channel art", size: "2560 x 1440" },
      { file: "thumbnail-youtube.png", label: "YouTube thumbnail", size: "1280 x 720" },
      { file: "logo-profile-circle.png", label: "Profile picture", size: "1000 x 1000" },
    ],
  },
  {
    title: "Logo",
    note: "The same lockup the site uses. The dark version inverts the mark so it stays visible.",
    items: [
      { file: "logo-lockup-light.png", label: "Lockup on light", size: "1200 x 400" },
      { file: "logo-lockup-dark.png", label: "Lockup on dark", size: "1200 x 400" },
      { file: "logo-square-brand.png", label: "Square mark", size: "800 x 800" },
    ],
  },
  {
    title: "Post cards",
    note: "Square, for a feed post that needs an image but not a screenshot.",
    items: [
      { file: "card-portal.png", label: "Client portal", size: "1080 x 1080" },
      { file: "card-contract.png", label: "Contract reading", size: "1080 x 1080" },
      { file: "card-price.png", label: "Free to start", size: "1080 x 1080" },
    ],
  },
  {
    title: "Screenshots",
    note: "Real captures of the product with sample data. Copy any of them straight into a post.",
    items: [
      { file: "shot-dashboard.png", label: "Your day" },
      { file: "shot-transactions.png", label: "All closings" },
      { file: "shot-transaction-tasks.png", label: "Inside a file" },
      { file: "shot-attachments.png", label: "Attachments checklist" },
      { file: "shot-key-dates.png", label: "Key dates" },
      { file: "shot-client-portal.png", label: "Client portal" },
      { file: "shot-contacts.png", label: "Contacts" },
      { file: "shot-clients.png", label: "Clients" },
      { file: "shot-calendar.png", label: "Calendar" },
      { file: "shot-templates.png", label: "Email templates" },
      { file: "shot-forms.png", label: "Form templates" },
      { file: "shot-intake-form.png", label: "Intake form" },
      { file: "shot-themes.png", label: "Colour themes" },
      { file: "shot-voice.png", label: "Voice search" },
      { file: "shot-invoices.png", label: "Invoices" },
    ],
  },
];

export interface DemoVideo {
  file: string;
  title: string;
  seconds: number;
  script: string;
}

export const DEMO_VIDEOS: DemoVideo[] = [
  {
    file: "freehold-01-tour.mp4",
    title: "A quick tour",
    seconds: 19,
    script: "vo-01-tour.txt",
  },
  {
    file: "freehold-02-attachments.mp4",
    title: "Documents and the checklist",
    seconds: 35,
    script: "vo-02-attachments.txt",
  },
  {
    file: "freehold-03-voice.mp4",
    title: "Just ask for what you need",
    seconds: 24,
    script: "vo-03-voice.txt",
  },
  {
    file: "freehold-04-portal.mp4",
    title: "What your client sees",
    seconds: 12,
    script: "vo-04-portal.txt",
  },
];

/**
 * Prompts for the presenter photos, which have to be generated outside this
 * repo (no image model here). Written as one character sheet plus per-shot
 * variations, because "same woman in every image" is the hard part: the
 * consistent thing has to be described identically every time, and only the
 * scene should change.
 */
export const PRESENTER_PROMPTS = {
  character:
    "A woman in her late thirties, shoulder-length dark brown hair with a soft " +
    "natural wave, warm light-olive skin, minimal natural makeup, small silver " +
    "stud earrings, wearing a soft sage-green blazer over a plain cream top. " +
    "Friendly, capable, relaxed expression. Photographic, natural window light " +
    "from the left, shallow depth of field, warm neutral colour grade.",
  shots: [
    {
      label: "Presenting to camera",
      use: "Facebook page cover, video intro card",
      prompt:
        "seated at a light oak desk in a bright home office, laptop open in front " +
        "of her, turned toward the camera mid-sentence with one hand gesturing " +
        "lightly, as if explaining something to a client on a video call. Soft " +
        "green plant and a stack of papers out of focus behind her. Horizontal, " +
        "space on the right for text.",
    },
    {
      label: "Looking at the screen",
      use: "Feature posts, blog headers",
      prompt:
        "in three-quarter profile looking at a laptop screen with a small, " +
        "satisfied smile, one hand on a notebook. Same desk, same room. " +
        "Horizontal, space on the left for text.",
    },
    {
      label: "On the phone",
      use: "Support and onboarding posts",
      prompt:
        "standing near a window holding a phone to her ear, listening, holding a " +
        "coffee mug in the other hand, relaxed and unhurried. Same room. Vertical " +
        "or square.",
    },
    {
      label: "Close portrait",
      use: "Profile photo, testimonial cards",
      prompt:
        "a warm head-and-shoulders portrait against a softly blurred office " +
        "background, looking directly at the camera, gentle smile. Square.",
    },
  ],
  howTo:
    "Generate the first image, then reuse that exact output as an image reference " +
    "or character reference for the other three so the face carries across. " +
    "Keep the character paragraph identical every time and change only the scene " +
    "sentence. Ask for 1536 x 1024 (horizontal) or 1024 x 1024 (square) so the " +
    "results drop into these layouts without a re-crop.",
} as const;
