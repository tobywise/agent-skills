# Review data

The agent writes `.plan-review/<id>/plan.json`. The CLI checks this shape:

```json
{
  "version": 1,
  "id": "email-reminders",
  "title": "Email reminders",
  "summary": "What the change is meant to achieve.",
  "pages": [
    {
      "id": "delivery",
      "title": "Delivery",
      "intro": "Choices about when and how reminders are sent.",
      "decisions": [
        {
          "id": "schedule",
          "title": "When should reminders be sent?",
          "importance": "important",
          "why": "The timing affects usefulness and notification volume.",
          "proposal": "Send one reminder the day before a task is due.",
          "options": [
            {
              "id": "day-before",
              "title": "One day before",
              "recommended": true,
              "detail": "A single reminder at 09:00 in the user's time zone.",
              "pros": ["Simple to explain"],
              "cons": ["May be too late for long tasks"]
            }
          ]
        }
      ]
    }
  ]
}
```

`importance` is `critical`, `important`, or `minor`. `options` may be omitted. Set `recommended` to `true` only for an option the plan recommends. A revised decision adds `"revision": { "round": 2, "note": "I changed the timing to ..." }`. Each page and decision needs a stable, unique lowercase ID made of letters, numbers, and hyphens. Do not put executable HTML or scripts in the data; the page displays text as text.

The browser records `ok`, `not_ok`, `change`, or `explain`. For `change`, the person can add a comment or rewrite the proposal. `not_ok` means the proposal is rejected. A selected option is meaningful only when the person accepts or requests a change. Questions and change requests must be resolved in a new round before finalizing.
