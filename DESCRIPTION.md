**Team Debrief: a team-level debrief built on top of Breakout Learning**
Prototype: https://team-debrief.vercel.app (try "Load sample team")

**Goal.** Breakout Learning (BL) grades individuals on how well they understand course concepts, and it shows those grades to instructors. A team leader needs to know how the *team* works and whether it follows its own charter. In our own BL session, the Group Balance Score said we "participated equally" even though the most active member talked 3.2× as much as the quietest (10.7 vs. 3.3 minutes). Team-level warning signs, like skipping the weaknesses discussion and saying we had "no skills gaps," were buried in individual feedback. Team Debrief combines those signals into one leader report.

**Inputs.** A meeting transcript (required), the team charter, BL talk times and feedback, and individual assessments.

**Outputs and class-based evidence.**
- *Per-person airtime flags* (under 0.6× or over 1.4× an equal share), not one pass/fail score. Woolley et al. found that equal turn-taking predicts collective intelligence, and an average can hide a silent member.
- *Airtime by meeting quarter and a who-responds-to-whom grid* expose hub-and-spoke patterns (Pentland's energy, engagement, and exploration).
- *Charter vs. reality* checks the meeting against the team's own norms. Per Hackman, norms only help if the team actually follows them.
- *Roles actually played* (Benne & Sheats) flag a team that depends on one person.
- *Team patterns* look for dropped ideas (psychological safety, Edmondson), quick unanimous votes (groupthink, Janis), and information only one member brought (hidden profiles, Stasser & Titus).
- *Three structural actions* for the leader, plus *private nudges* for each member. Feedback stays private to protect psychological safety.

**Design choices.** The participation numbers are computed exactly in the browser. The AI (GPT) is used only for judgment calls and must quote the transcript as evidence.
