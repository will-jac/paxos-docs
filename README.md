# Paxos Document Editor

Love collaboration? Hate Google spying on you? Use a truly decentralized, collaborative document editor!

## Overview

The Paxos document editor connects users (each individual browser tab that has the document loaded) together using the Paxos Protocol, which guarantees consistency among users.

## Technical Details

### Paxos

Paxos is a complicated consensus protocol. In the basic algorithm, a set of priests communicate via messages to pass decrees. The protocol guarantees that all priests will record the same decrees in the same order in their ledgers.

The algorithm consists of 6 steps, which can be grouped into 2 phases. In the phase 1, a priest broadcasts\* a *prepare* message (also known as a P1A message) to the other priests. Upon recieving the *prepare* message, the other priests respond with a *promise*. If the initiator recieves *promises* from a quorum of preists, then it begins phase 2. In phase 2, the priest sends an *accept* message to every priest in the quorum, containing the decree to be passed. Upon receiving the *accept* message, each priest responds by broadcasting an *accepted* message. If a priest recieves an *accepted* message from every priest in the quorum, the decree passes.

In order to encourage progress, the priest that sends the *prepare* and *accept* messages, initiating phase 1 and phase 2, is considered the leader. In the standard protocol, there is only one leader, which helps to prevent the system from locking due to multiple leaders disagreeing on who is in charge (to anthromorphize the protocol). In this implementation, the leader is the first priest that advances to phase 2.

This entire process has an associated monotonically increasing ballot number\*\*. When a priest initiates phase 1 with a *prepare* message, it sends the ballot number it is using. Each *promise* message that a priest responds with is a promise that the priest will not send a promise for a ballot with a lower ballot number. Then, when phase 2 begins, the ballot number of the *accept* message must exactly match the promised ballot number for the priest to respond with an *accepted* message.

Additionally, because the only important component of phase 1 is leader selection (that is, guaranteeing that there no other priest will send *accept* message, which could prevent progress), it is unecessary to repeat for multiple ballots that are initiated by the same leader. In this case, phase 1 can be skipped and phase 2 directly initiated. Under this scheme, a decree is passed in three message delays (the client sends a message to the leader, the leader sends an *accept* message, and the priests respond with and *accepted* message). Another scheme, Fast Paxos, lowers the required number of message delays to two, where the client broadcasts and *accept* message and each priest responds with an *accepted* message, having each determined a ballot number for the decree. If all ballot numbers match, then the decree is passed, with leader interfering (with an additional two message delays) in the case of conflicts). This proved too complex to reliably implement in a short period of time, and so is not used here.

\* In this implementaton, a priest will send a message to itself upon broadcast.
\*\* Each priest will have a unique ballot number, trivially by including a unique priest identifier with each integer ballot number and using the identifier to break ties.

### Implementation

This entire project is written in JavaScript. It is decomposed into three components: the display code, the messenging code, and the code that runs the paxos protocol.

The display code for this project is written in React, a JavaScript library that allows embedding HTML inside of JavaScript via JSX fragments. React handles the state of the webpage, automatically reloading only the components that have changed, which allows updating stateful components without reloading the entire webpage. For the actual text editor, a React-ified [fork](https://github.com/zenoamaro/react-quill/) of the [Quill](https://quilljs.com/) text editor is used.

Quill is an excellent library that which exposes an `onchange` function handle for when the editor has any content changes, which is used to call the Paxos code.

Two messaging libraries are used in this project. The primary messenging library is [peerjs](peerjs.com), which permits (mostly) serverless, peer to peer communication between browsers. A central server is required for connection initialization and for use as a fallback in the case of firewalls and reverse network proxies. To connect to the central server, [socket.io](socket.io) is used, which is an easy to use, event based messaging libary. Both peerjs and socket.io use websockets for their connections.

The connection to the server is used to connect a priest to all the others. After all the peers have connected to each other, the underlying websocket manages most of the important components of the connnection, such as sending heatbeats, which is important for maintaining the leader in Paxos.

