import { Card } from "@/components/ui";

export default function VoicePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Voice-first writing support</h1>
        <p className="text-sm text-slate-600">A one-page explainer tutors can share with students, faculty and each other.</p>
      </div>
      <Card title="AI detectors are unreliable, and biased">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Detectors guess from patterns in the text. They make false accusations, and nobody can verify their scores.</li>
          <li>Studies of popular detectors have found they flag writing by multilingual writers as AI-generated more often than writing by native speakers.</li>
          <li>Writers who use plain, careful or formulaic language, including neurodivergent writers, can be flagged too.</li>
          <li>That is why GAIT has no detector and never gives a verdict on who wrote a text.</li>
        </ul>
      </Card>
      <Card title="Linguistic diversity is a strength">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Many English varieties and dialects are valid. A phrase that is unusual is not automatically an error.</li>
          <li>Standardizing a writer&apos;s English can erase their voice and their way of thinking. Ask about meaning before correcting form.</li>
          <li>Clarity for the reader matters, but the writer decides how much of their own voice to keep.</li>
        </ul>
      </Card>
      <Card title="What voice-first mode does">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Keeps suggestions in the writer&apos;s own phrasing.</li>
          <li>Flags feedback that only standardizes English, so the tutor can decide.</li>
          <li>Treats unusual phrasing as a choice to ask about in ownership questions.</li>
          <li>Turn it on from the After session page or the Talking about AI page. It is saved in this browser only.</li>
        </ul>
      </Card>
      <Card title="What to do instead of detecting">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Ask about the writer&apos;s process and ideas, with curiosity.</li>
          <li>Check the course&apos;s AI policy together.</li>
          <li>Invite the writer to explain their claims in their own words.</li>
        </ul>
      </Card>
    </div>
  );
}
