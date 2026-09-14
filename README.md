# 🔄 Mealy–Moore Machine Simulator

A web-based **Mealy–Moore Machine Simulator** built using React and Vite.
This project provides an interactive platform to create, simulate, convert, and compare Mealy and Moore machines.

---

## 📌 Project Overview

The **Mealy–Moore Machine Simulator** is an educational web application developed to make **Theory of Computation and Finite State Machines** easier to understand through an interactive interface.

The application allows users to:

* Create Mealy and Moore machines
* Add and manage states
* Create transitions
* Define input and output symbols
* Validate machines
* Simulate input strings
* View step-by-step execution
* Convert Mealy machines to Moore machines
* Compare two machines
* Save machine configurations
* Import and export machine data

---

## ✨ Features

### 🏠 Dashboard

Provides quick access to the major modules of the simulator.

### 🛠️ Machine Builder

Allows users to visually create and configure finite-state machines.

**Features include:**

* Add states
* Remove states
* Set initial state
* Set final state
* Add transitions
* Define input symbols
* Define output symbols
* Validate machine structure

### ▶️ Simulator

Allows users to execute an input string on the selected machine.

The simulator displays:

* Current state
* Input symbol
* Transition
* Generated output
* State sequence
* Simulation steps
* Final result

### 🔄 Conversion Lab

Converts a **Mealy Machine into a Moore Machine** and displays the conversion process.

### ⚖️ Compare Machines

Allows users to compare two machines based on their structure and behaviour.

### 💾 Saved Machines

Allows created machines to be stored and reused later.

### 📥 Import / Export

Machine configurations can be imported and exported using JSON data.

---

# 🧠 Mealy Machine

A **Mealy Machine** is a finite-state machine in which the output depends on both the current state and the input.

```text
Current State + Input → Output + Next State
```

Example:

```text
q0 -- 1/0 --> q1
```

Here:

* `q0` = Current State
* `1` = Input
* `0` = Output
* `q1` = Next State

---

# 🧠 Moore Machine

A **Moore Machine** is a finite-state machine in which the output depends only on the current state.

```text
Current State → Output
```

Example:

```text
q0 / 0
```

Here:

* `q0` = State
* `0` = Output

---

# 🔄 Mealy vs Moore

| Feature                | Mealy Machine   | Moore Machine  |
| ---------------------- | --------------- | -------------- |
| Output depends on      | State + Input   | State          |
| Output associated with | Transition      | State          |
| Output changes         | With transition | With state     |
| Number of states       | Usually fewer   | Usually more   |
| Representation         | Input / Output  | State / Output |

---

# 🖥️ Application Screenshots

## 🏠 1. Dashboard

The dashboard provides an overview of the simulator and quick access to the available modules.

<p align="center">
  <img src="./screenshots/dashboard.png" alt="Dashboard" width="900">
</p>

---

## 🛠️ 2. Machine Builder

The Machine Builder allows users to create Mealy and Moore machines by defining states and transitions.

<p align="center">
  <img src="./screenshots/machine-builder.png" alt="Machine Builder" width="900">
</p>

---

## ▶️ 3. Simulator

The Simulator allows users to enter an input string and execute the selected finite-state machine.

<p align="center">
  <img src="./screenshots/simulator.png" alt="Simulator" width="900">
</p>

---

## 📊 4. Simulation Result

The simulation result displays the execution steps, state transitions, generated output, and final result.

<p align="center">
  <img src="./screenshots/simulation-result.png" alt="Simulation Result" width="900">
</p>

---

## 🔄 5. Conversion Lab

The Conversion Lab demonstrates the conversion of a Mealy Machine into a Moore Machine.

<p align="center">
  <img src="./screenshots/conversion.png" alt="Conversion Lab" width="900">
</p>

---

## ⚖️ 6. Compare Machines

The Compare Machines module allows users to compare two finite-state machines.

<p align="center">
  <img src="./screenshots/comparison.png" alt="Compare Machines" width="900">
</p>

---

# 🛠️ Technologies Used

* **React**
* **Vite**
* **JavaScript**
* **HTML5**
* **CSS3**
* **Lucide React**

---

# 📂 Project Structure

```text
mealy-moore-simulator/
│
├── public/
│
├── screenshots/
│   ├── dashboard.png
│   ├── machine-builder.png
│   ├── simulator.png
│   ├── simulation-result.png
│   ├── conversion.png
│   └── comparison.png
│
├── src/
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   └── main.jsx
│
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
└── README.md
```

---

# ⚙️ Installation

### 1. Clone the repository

```bash
git clone <https://github.com/prachi-ankush-3/mealy-moore-machine-simulator.git>
```

### 2. Navigate to the project

```bash
cd mealy-moore-simulator
```

### 3. Install dependencies

```bash
npm install
```

### 4. Start the development server

```bash
npm run dev
```

The application will normally run at:

```text
http://localhost:5173
```

---

# 🚀 How to Use

### Step 1 — Open Dashboard

Launch the application and open the Dashboard.

### Step 2 — Create a Machine

Go to **Machine Builder** and select either:

* Mealy Machine
* Moore Machine

### Step 3 — Add States

Create states such as:

```text
q0
q1
q2
```

Set the required initial and final states.

### Step 4 — Add Transitions

For a Mealy machine, define:

```text
Input / Output
```

Example:

```text
0 / 1
1 / 0
```

### Step 5 — Validate

Validate the machine to identify invalid or incomplete configurations.

### Step 6 — Simulate

Enter an input string, for example:

```text
010101
```

Run the simulation and observe the generated output.

### Step 7 — Convert

Open **Conversion Lab** to convert a Mealy machine into a Moore machine.

### Step 8 — Compare

Use **Compare Machines** to compare two machines.

---

# 🎯 Objectives

The main objectives of this project are:

1. To provide an interactive environment for designing finite-state machines.
2. To simulate Mealy and Moore machines.
3. To visualize machine execution.
4. To demonstrate Mealy-to-Moore conversion.
5. To help students understand sequential machines practically.
6. To provide an easy-to-use educational tool for Theory of Computation.

---

# 🔮 Future Scope

The project can be further extended with:

* Moore → Mealy conversion
* DFA/NFA simulator
* Regular Expression → Automata conversion
* DFA minimization
* State diagram export
* Advanced equivalence checking
* User authentication
* Cloud storage
* More automata algorithms

---

# 🎓 Academic Application

This project can be used for:

* Theory of Computation
* Automata Theory
* Finite State Machines
* Computer Science Laboratory
* Micro Projects
* Academic Demonstrations
* Viva Presentations

---

# 👩‍💻 Author

**Prachi Ankush**

B.Tech Computer Engineering
Vishwakarma Institute of Technology, Pune

---

## ⭐ Project

> **An interactive way to learn, build, simulate, convert, and compare finite-state machines.**

---

## 📄 License

This project is developed for educational and academic purposes.
