export type TalkScenario = {
  id: string;
  label: string;
  intro: string;
  openers: string[];
  followUps: string[];
  dontSay: string[];
  steerBack: string[];
};

/** Fixed script bank. Everything here is curiosity-first and never accuses or judges authorship. */
export const TALK_SCENARIOS: TalkScenario[] = [
  {
    id: "suspected",
    label: "A draft seems different from the student's usual writing",
    intro: "You can't know how a text was made, and you don't need to. Get curious about the student's process and their ideas.",
    openers: [
      "Tell me how you got started on this draft. What did your process look like?",
      "Pick a paragraph you feel strongest about and walk me through what you wanted it to do.",
      "What was the hardest part of this assignment for you?",
    ],
    followUps: [
      "What tools or resources did you use along the way, if any? I ask everyone.",
      "If your professor asked you to explain this claim out loud, what would you say?",
      "Which part would you most like to work on today?",
    ],
    dontSay: [
      "\"This sounds like AI.\" You can't know, and it shuts the conversation down.",
      "\"Did you write this?\" It is an accusation, even when it is asked gently.",
      "Anything about running the text through a detector. Detectors are unreliable and biased against multilingual writers.",
    ],
    steerBack: [
      "Ask the student to explain their thesis and evidence in their own words, then work from what they say.",
      "Move to higher-order concerns: purpose, claim, organization. Let the student hold the pen.",
      "If the course policy is unclear, look at the syllabus together.",
    ],
  },
  {
    id: "admits",
    label: "The student says they used AI",
    intro: "Thank them for being open. Their honesty is the best thing that can happen here.",
    openers: [
      "Thanks for telling me. What did you use it for, and what did you ask it?",
      "What did you keep from what it gave you, and what did you change?",
      "How did it feel to work with it? Was it useful, or did it get in the way?",
    ],
    followUps: [
      "What does your syllabus say about AI? Let's look at it together.",
      "Which ideas here are yours, and which came from the tool? Let's mark them.",
      "How could you disclose or cite how you used it?",
    ],
    dontSay: [
      "\"That's cheating.\" Whether it breaks the rules depends on the course policy, and that is not your call.",
      "\"Don't tell your professor.\" Never help hide AI use.",
      "\"I can't help you now.\" You can still coach their own thinking.",
    ],
    steerBack: [
      "Check the course policy together, and offer the reflection card on the printable page.",
      "Ask the student to explain the claim and the evidence in their own words.",
      "Set a goal for the part they will write themselves.",
    ],
  },
  {
    id: "humanize",
    label: "The student asks you to make a draft \"sound human\" or \"sound like me\"",
    intro: "You don't disguise text, and you don't rewrite it. You can help the student find their own voice.",
    openers: [
      "I won't change the wording, but I'm happy to help you find your own. What would you say if you were explaining this to a friend?",
      "What worries you most about how this sounds?",
      "Tell me about a sentence here that doesn't sound like you. What would you change about it?",
    ],
    followUps: [
      "Try saying your main point out loud, then write what you said. How is it different?",
      "Where did this draft come from? Let's check what your professor allows.",
      "Which parts do you want to rebuild in your own words, and which ideas are yours to keep?",
    ],
    dontSay: [
      "\"I'll make it sound more natural.\" That is rewriting for them.",
      "\"Here's how to get it past a detector.\" Never help avoid detection.",
      "\"Just change a few words.\" That teaches disguise, not writing.",
    ],
    steerBack: [
      "Do a freewrite on the main idea, then compare it with the draft.",
      "Ask questions about their purpose and audience so the student decides what to say.",
      "Name a strong phrase from their own talk and point out why it works.",
    ],
  },
  {
    id: "brainstorm",
    label: "AI is allowed for brainstorming and the student asks how to use it",
    intro: "Show them how to use AI as a coach, which asks questions, instead of a ghostwriter, which writes.",
    openers: [
      "Good, your course allows it. What would you like it to help with: ideas, questions, or checking your reasoning?",
      "Let's plan how you'd use it. What will you do yourself before you ask it anything?",
      "What would a good question for it look like? Let's write one together.",
    ],
    followUps: [
      "Try adding \"Don't rewrite it for me\" to your prompt. What changes?",
      "After it answers, which idea do you want to keep, and why?",
      "How will you note that you used it, if your professor asks for disclosure?",
    ],
    dontSay: [
      "\"Just ask it to write an outline and use that.\" The outline is the thinking.",
      "\"It's fine, everyone does it.\" Check the policy first.",
      "\"Trust whatever it says.\" Tools get facts and sources wrong.",
    ],
    steerBack: [
      "Have the student write their own thesis attempt first, then ask the tool to quiz them on it.",
      "Practice checking one claim from the tool against a real source.",
      "Close by asking what the student learned that they could not have gotten by copying.",
    ],
  },
  {
    id: "overreliance",
    label: "The student accepts everything the AI says",
    intro: "The goal is a student who questions the tool, not one who stops using it.",
    openers: [
      "What did the tool suggest, and what do you think about it?",
      "Where did you disagree with it, even a little?",
      "How would you check whether that advice is right for this assignment?",
    ],
    followUps: [
      "Does your professor's assignment sheet agree with what it said?",
      "What would you tell it if you thought it was wrong?",
      "Which of its suggestions did you decide on yourself, and how?",
    ],
    dontSay: [
      "\"Stop using it.\" It isn't helpful and may be against nothing in the policy.",
      "\"It's usually wrong.\" Show them how to check instead.",
      "\"Just do what I say instead.\" The aim is the student's own judgment, not swapping one authority for another.",
    ],
    steerBack: [
      "Pick one suggestion and have the student argue for and against it.",
      "Ask the student to rank the feedback by what matters most for their reader.",
      "Practice a coaching prompt that asks the tool questions instead of asking for answers.",
    ],
  },
];

/** Keep only strings that are really questions, and cap how many. */
export function onlyQuestions(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter((x) => x.endsWith("?") && x.length < 300)
    .slice(0, 5);
}
