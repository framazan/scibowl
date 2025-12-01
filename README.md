# atombowl

[![Deployment to Firebase Hosting](https://github.com/framazan/scibowl/actions/workflows/firebase-hosting-merge.yml/badge.svg?branch=main)](https://github.com/framazan/scibowl/actions/workflows/firebase-hosting-merge.yml)

atombowl is a comprehensive platform designed to enhance preparation for Science Bowl competitions (it's also useful for other competitions too, like USABO!). It provides a suite of tools for practicing with science quiz questions in any subject. It features the **largest ever Science Bowl question database** at over 100,000 questions. All questions were curated via a custom AI algorithm, making them render in beautiful LaTeX on the website. No more wonky equations or questions with messed up formatting. Answers on all tools are checked via `gemini-2.5-flash` with sub-second latency, so no more [protobowl.com](https://protobowl.com)-esque wacky grading.

---

## What is Science Bowl? (in case you don't know)

Science Bowl is a fast-paced, buzzer-based quiz competition where teams compete to answer questions on various scientific topics. Questions are divided into toss-ups (answered individually) and bonuses (team-based). Competitions emphasize quick recall, critical thinking, and teamwork.

atombowl bridges the gap between raw question data and effective study by normalizing content, providing structured practice sessions in the form of a multiplayer platform and an individual practice feature. It also offfers analytics to track progress.

---

## Key Features

- **Curated Question Database**: Access a growing collection of questions acquired and standardized through automated Python scripts, ensuring consistency in formatting, categories, and difficulty levels. It includes all the major tournaments and invitationals (MIT, Berkeley, Stanford, Prometheus, 50+ more)
- **Real-Time Multiplayer Sessions**: Firebase's Realtime Database is used for a multiplayer mode with sub-90ms latency where users can buzz in, answer questions, and their friends can see what they are typing/doing instantly. Similar to QBreader or Protobowl, just with a better answer checker, more questions, and excellent formatting.
- **Practice Mode**: Practice indivdually, but with Gemini explaining why you got an answer wrong/correct. Also, you get a nice multiple choice web-rendered format.
- **Round Generator**: Tired of repeat questions? Generate a round with which categories you want, from what tournaments you want.
- **Buzzer**: Latency corrected buzzer system that let's you (as a host) read questions in-app while managing a buzzer. Way simpler than multitasking windows on Mac or Windows.
- **Account**: Every round you generate, every buzzer you host, and all your stats all get synced to Google Cloud Platform securely under your account, if you create one.
---

## Getting Started

### For Users
1. **Access the Platform**: Visit the live atombowl site at [sciencebowl.org](https://sciencebowl.org)
2. **Sign Up/Login**: Create an account to track your progress and customize your practice, as well as host buzzers.
3. **Start Practicing**: Choose from available question sets, start a multiplayer game, a practice session, or generate a round, and begin improving.

### For Developers and Contributors
If you'd like to contribute to the development of atombowl, or just make your own version:

1. Fork and clone the repository.
2. Set up your development environment (just install npm dependencies). If you want to make your own, initiate your own Firebase project.
3. Make changes, test locally with Firebase emulators, and submit a pull request.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## Future Plans

I want to continuously improve atombowl. Upcoming enhancements include expanded analytics, a team portal feature, and mobile support. Any ideas? Email Filip at [filip123@duck.com](mailto:filip123@duck.com)
