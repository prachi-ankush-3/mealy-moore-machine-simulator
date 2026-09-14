# 🔄 Mealy–Moore Machine Simulator

A web-based **Finite State Machine Simulator** built with React and Vite to create, simulate, convert, compare, and save **Mealy and Moore Machines**.

The project provides an interactive interface for understanding **Finite Automata and Sequential Machines** through visual state diagrams, step-by-step simulation, and automatic Mealy ↔ Moore conversion.

---

## 📌 Project Overview

The **Mealy–Moore Simulator** is designed as an educational tool for students and developers studying **Theory of Computation (TOC)** and **Finite State Machines**.

The simulator allows users to:

* Create Mealy and Moore machines
* Add and edit states
* Create transitions
* Define input and output alphabets
* Validate machines
* Simulate input strings
* View step-by-step execution
* Convert Mealy machines to Moore machines
* Compare two machines
* Save and manage machines
* Import/export machine data
* View documentation about Mealy and Moore machines

---

## ✨ Features

### 🏠 Dashboard

Provides an overview of the simulator and quick access to the main modules.

### 🛠️ Machine Builder

Create a custom finite state machine using an interactive builder.

**Supported operations:**

* Add states
* Delete states
* Edit state names
* Set initial state
* Set final state
* Define state outputs for Moore machines
* Create transitions
* Define input/output symbols
* Validate machine structure

### ▶️ Simulator

Run an input string through the selected machine and observe its execution.

The simulator provides:

* Current state
* Input symbol
* Transition taken
* Output generated
* States visited
* Transitions used
* Final state
* Complete simulation steps

### 🔄 Conversion Lab

Convert a **Mealy Machine into a Moore Machine**.

The conversion module provides a detailed conversion log showing how new Moore states and transitions are generated.

### ⚖️ Compare Machines

Compare two machines based on their:

* Machine type
* States
* Transitions
* Input alphabet
* Output alphabet
* Behaviour for given inputs

### 💾 Saved Machines

Save created machines and access them later without rebuilding them from scratch.

### 📚 Documentation

Built-in documentation explains important concepts related to:

* Mealy Machines
* Moore Machines
* States
* Transitions
* Input and output alphabets
* Machine simulation
* Machine conversion

### 📥 Import / Export

Machine configurations can be exported and imported using JSON data, making it easier to share or reuse machines.

---

# 🧠 Mealy Machine

A **Mealy Machine** is a finite-state machine where the output depends on:

> **Current State + Input**

The output is associated with a **transition**.

### Example

```text
q0 -- 1/0 --> q1
```

Here:

* `1` = Input
* `0` = Output
* `q0` = Current State
* `q1` = Next State

---

# 🧠 Moore Machine

A **Moore Machine** is a finite-state machine where the output depends only on:

> **Current State**

The output is associated with a **state**.

### Example

```text
q0 / 0
```

Here:

* `q0` = State
* `0` = Output of the state

---

# 🔄 Mealy vs Moore

| Feature                | Mealy Machine   | Moore Machine    |
| ---------------------- | --------------- | ---------------- |
| Output depends on      | State + Input   | State            |
| Output associated with | Transition      | State            |
| Output changes         | With transition | With state       |
| Number of states       | Usually fewer   | May require more |
| Output representation  | `input/output`  | `state/output`   |

---

# 🖥️ Application Screenshots

> Add your project output screenshots in the spaces provided below.

## 1. Dashboard

**Output Screenshot:**

📷 **[ Add Dashboard Screenshot Here ]**

```text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                    DASHBOARD SCREENSHOT                      │
│                                                              │
│              Insert your screenshot here                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Machine Builder

**Output Screenshot:**

📷 **[ Add Machine Builder Screenshot Here ]**

```text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                  MACHINE BUILDER SCREENSHOT                  │
│                                                              │
│              Insert your screenshot here                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Simulator

**Output Screenshot:**

📷 **[ Add Simulator Screenshot Here ]**

```text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                    SIMULATOR SCREENSHOT                      │
│                                                              │
│              Insert your screenshot here                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Simulation Result

**Output Screenshot:**

📷 **[ Add Simulation Result Screenshot Here ]**

```text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                 SIMULATION RESULT SCREENSHOT                 │
│                                                              │
│              Insert your screenshot here                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Conversion Lab

**Output Screenshot:**

📷 **[ Add Conversion Screenshot Here ]**

```text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                   CONVERSION LAB SCREENSHOT                  │
│                                                              │
│              Insert your screenshot here                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Compare Machines

**Output Screenshot:**

📷 **[ Add Comparison Screenshot Here ]**

```text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                  COMPARE MACHINES SCREENSHOT                 │
│                                                              │
│              Insert your screenshot here                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Project Structure

```text
mealy-moore-simulator/
│
├── public/
│   ├── favicon.svg
│   └── icons.svg
│
├── src/
│   ├── assets/
│   │   ├── hero.png
│   │   ├── react.svg
│   │   └── vite.svg
│   │
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

# 🛠️ Technologies Used

* **React**
* **Vite**
* **JavaScript**
* **CSS**
* **Lucide React**
* **HTML5**

---

# ⚙️ Installation

### 1. Clone the repository

```bash
git clone <https://github.com/prachi-ankush-3/mealy-moore-machine-simulator.git>
```

### 2. Open the project

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

The application will be available at the local URL displayed by Vite, usually:

```text
http://localhost:5173
```

---

# 🚀 How to Use

### Step 1 — Create a Machine

Open **Machine Builder** and select:

* Mealy Machine
* Moore Machine

### Step 2 — Add States

Create states such as:

```text
q0
q1
q2
```

Set the required initial/final states.

### Step 3 — Add Transitions

Define transitions using the required input symbols.

For a Mealy machine:

```text
Input / Output
```

For example:

```text
0 / 1
1 / 0
```

### Step 4 — Validate

Use the validation functionality to identify:

* Missing transitions
* Duplicate state names
* Invalid symbols
* Missing initial state
* Unreachable states
* Conflicting transitions

### Step 5 — Simulate

Enter an input string such as:

```text
010101
```

Run the simulation to view the generated output and execution steps.

### Step 6 — Convert

Open **Conversion Lab** to convert a Mealy machine into a Moore machine.

### Step 7 — Compare

Use **Compare Machines** to analyze two machines side-by-side.

---

# 📊 Example

### Mealy Machine

```text
States:
q0, q1

Input Alphabet:
0, 1

Transitions:

q0 -- 0/0 --> q0
q0 -- 1/1 --> q1
q1 -- 0/1 --> q0
q1 -- 1/0 --> q1
```

For input:

```text
1010
```

The simulator processes each input symbol and generates the corresponding output sequence.

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

The project can be extended with:

* Moore → Mealy conversion
* DFA/NFA simulator
* Regular expression to automata conversion
* State diagram export as image
* Advanced equivalence checking
* Machine minimization
* Dark/light theme customization
* Cloud-based machine storage
* User authentication
* More detailed graph visualization

---

# 🎓 Academic Use

This project can be used for:

* Theory of Computation
* Automata Theory
* Finite State Machines
* Computer Science Laboratory
* Micro Projects
* Demonstrations and Viva

---

# 👩‍💻 Author

**Prachi Ankush**

B.Tech Computer Engineering
Vishwakarma Institute of Technology, Pune

---

## ⭐ Project

**Mealy–Moore Machine Simulator**

> An interactive way to learn, build, simulate, convert, and compare finite-state machines.

---

## 📄 License

This project is created for educational and academic purposes.
