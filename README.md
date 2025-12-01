# atombowl

[![Deployment to Firebase Hosting](https://github.com/framazan/scibowl/actions/workflows/firebase-hosting-merge.yml/badge.svg?branch=main)](https://github.com/framazan/scibowl/actions/workflows/firebase-hosting-merge.yml)

atombowl is a comprehensive platform designed to enhance preparation for Science Bowl competitions (it's also useful for other competitions too, like USABO!). It provides a suite of tools for practicing with science quiz questions in any subject. It features the *largest ever Science Bowl question database* at over 100,000 questions. All questions were curated via a custom AI algorithm, making them render in beautiful $`\LaTeX`$.

---

## What is Science Bowl?

Science Bowl is a fast-paced, buzzer-based quiz competition where teams compete to answer questions on various scientific topics. Questions are divided into toss-ups (answered individually) and bonuses (team-based). Competitions emphasize quick recall, critical thinking, and teamwork.

atombowl bridges the gap between raw question data and effective study by normalizing content, providing structured practice sessions, and offering analytics to track progress.

---

## Key Features

- **Curated Question Database**: Access a growing collection of questions acquired and standardized through automated Python scripts, ensuring consistency in formatting, categories, and difficulty levels.
- **Interactive Web Frontend**: A user-friendly interface built with JavaScript, TypeScript, HTML, and CSS, served via Firebase Hosting for seamless access on any device.
- **Real-Time Practice Sessions**: Leverage Firebase's Realtime Database for live, interactive quizzes where users can buzz in, answer questions, and receive instant feedback.
- **Cloud Backend**: Serverless Cloud Functions handle data processing, user authentication, scoring, and analytics without server management.
- **Secure Storage and Rules**: Firebase Firestore and Storage manage data securely, with custom rules to protect user privacy and content integrity.
- **AI-Assisted Preparation**: Incorporate AI features for intelligent question generation, adaptive difficulty adjustment, and personalized recommendations based on user performance (currently in development).
- **Performance Monitoring**: Built-in tools to test and optimize latency, ensuring quick response times that mimic real competition conditions. Use Python scripts like `rate_limit_test.py` to benchmark throughput and identify bottlenecks.
- **Data Acquisition Utilities**: Python tools for scraping, cleaning, and ingesting question data from APIs, websites, and other sources, maintaining data provenance and quality.

---

## How atombowl Helps with Preparation

atombowl empowers users to prepare effectively for Science Bowl competitions through:

- **Targeted Practice**: Filter questions by subject, difficulty, and type to focus on weak areas and build speed.
- **Analytics and Insights**: Track answer accuracy, response times, and progress over time. Identify patterns in mistakes and receive suggestions for improvement.
- **Low-Latency Experience**: Optimized Firebase infrastructure minimizes delays, allowing for realistic simulation of competition pacing.
- **AI-Powered Learning**: Future AI integrations will analyze user data to generate custom questions, predict strengths/weaknesses, and tailor study plans.
- **Collaborative Tools**: Share practice sessions or compete with peers in real-time, fostering teamwork skills.

Whether you're a student preparing for your first tournament or a coach refining team strategies, atombowl provides the tools to turn knowledge into competitive advantage.

---

## Getting Started

### For Users
1. **Access the Platform**: Visit the live atombowl site hosted on Firebase (link in badge above).
2. **Sign Up/Login**: Create an account to track your progress and customize your practice.
3. **Start Practicing**: Choose from available question sets, start a quiz, and begin improving.

No installation required—everything runs in your browser.

### For Developers and Contributors
If you'd like to contribute to the development of atombowl:

1. Fork and clone the repository.
2. Set up your development environment (see repository for details on Node.js, Python, and Firebase).
3. Make changes, test locally with Firebase emulators, and submit a pull request.

---

## Contributing

We welcome contributions from the community! Whether it's adding new questions, improving the UI, or enhancing AI features, your input helps make atombowl better.

1. Fork the repo.
2. Create a feature branch.
3. Commit your changes.
4. Open a pull request with a clear description.

For detailed development setup, workflows, and testing guidelines, refer to the repository's technical documentation.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## Future Plans

We're continuously improving atombowl. Upcoming enhancements include expanded AI capabilities, more question sources, advanced analytics, and mobile app support. Stay tuned for updates!

For questions or feedback, open an issue in the repository.
