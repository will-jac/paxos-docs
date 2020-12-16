# Paxos Document Editor

Love collaboration? Hate Google spying on you? Use a truly decentralized, collaborative document editor!

This project also has a server, in a different repo: https://github.com/will-jac/paxos-server

All the documentation is here, however.

## Overview

The Paxos document editor connects users (each individual browser tab that has the document loaded) together using the Paxos Protocol, which guarantees consistency among users.

## Technical Details

Paxos is a complicated consensus protocol. In the basic algorithm, a set of priests communicate via messages to pass decrees. The protocol guarantees that all priests will record the same decrees in the same order in their ledgers.

The algorithm consists of 6 steps, which can be grouped into 2 phases. In the phase 1, a priest broadcasts\* a *prepare* message (also known as a P1A message) to the other priests. Upon recieving the *prepare* message, the other priests respond with a *promise*. If the initiator recieves *promises* from a quorum of preists, then it begins phase 2. In phase 2, the priest sends an *accept* message to every priest in the quorum, containing the decree to be passed. Upon receiving the *accept* message, each priest responds by broadcasting an *accepted* message. If a priest recieves an *accepted* message from every priest in the quorum, the decree passes.

In order to encourage progress, the priest that sends the *prepare* and *accept* messages, initiating phase 1 and phase 2, is considered the leader. In the standard protocol, there is only one leader, which helps to prevent the system from locking due to multiple leaders disagreeing on who is in charge (to anthromorphize the protocol). In this implementation, the leader is the first priest that advances to phase 2.

This entire process has an associated monotonically increasing ballot number\*\*. When a priest initiates phase 1 with a *prepare* message, it sends the ballot number it is using. Each *promise* message that a priest responds with is a promise that the priest will not send a promise for a ballot with a lower ballot number. Then, when phase 2 begins, the ballot number of the *accept* message must exactly match the promised ballot number for the priest to respond with an *accepted* message.

Additionally, because the only important component of phase 1 is leader selection (that is, guaranteeing that there no other priest will send *accept* message, which could prevent progress), it is unecessary to repeat for multiple ballots that are initiated by the same leader. In this case, phase 1 can be skipped and phase 2 directly initiated. Under this scheme, a decree is passed in three message delays (the client sends a message to the leader, the leader sends an *accept* message, and the priests respond with and *accepted* message). Another scheme, Fast Paxos, lowers the required number of message delays to two, where the client broadcasts and *accept* message and each priest responds with an *accepted* message, having each determined a ballot number for the decree. If all ballot numbers match, then the decree is passed, with leader interfering (with an additional two message delays) in the case of conflicts). This proved too complex to reliably implement in a short period of time, and so is not used here.

\* In this implementaton, a priest will send a message to itself upon broadcast.
\*\* Each priest will have a unique ballot number, trivially by including a unique priest identifier with each integer ballot number and using the identifier to break ties.

### Implementation

This entire project is written in JavaScript. It is decomposed into three components: the display code, the messenging code, and the code that runs the paxos protocol.

#### Display

The display code for this project is written in React, a JavaScript library that allows embedding HTML inside of JavaScript via JSX fragments. React handles the state of the webpage, automatically reloading only the components that have changed, which allows updating stateful components without reloading the entire webpage. For the actual text editor, a React-ified [fork](https://github.com/zenoamaro/react-quill/) of the [Quill](https://quilljs.com/) text editor is used.

Quill is an excellent library that which exposes an `onchange` function handle for when the editor has any content changes, which is used to call the Paxos code.

#### Messaging

Two messaging libraries are used in this project. The primary messenging library is [peerjs](peerjs.com), which permits (mostly) serverless, peer to peer communication between browsers. A central server is required for connection initialization and for use as a fallback in the case of firewalls and reverse network proxies. To connect to the central server, [socket.io](socket.io) is used, which is an easy to use, event based messaging libary. Both peerjs and socket.io use websockets for their connections.

The connection to the server is used to connect a priest to all the others. After all the peers have connected to each other, the underlying websocket manages most of the important components of the connnection, such as sending heatbeats, which is important for maintaining the leader in Paxos.

Both peerjs and socket.io initially connect to a [central server](https://github.com/will-jac/paxos-server). The server simply listens for an incoming connection and responds with the list of clients to connect to (their uuids). It also notifies all other connected clients when  disconnections occur (the connecting cient notifies all the others on connection).

#### Paxos

The actual Paxos implemnation is heavily inspired by three papers:

* [The Part-Time Parliament](https://www.microsoft.com/en-us/research/publication/part-time-parliament/?from=http%3A%2F%2Fresearch.microsoft.com%2Fen-us%2Fum%2Fpeople%2Flamport%2Fpubs%2Flamport-paxos.pdf)
* [Paxos Made Simple](http://lamport.azurewebsites.net/pubs/paxos-simple.pdf)
* [Paxos Made Moderately Complex](https://dl.acm.org/doi/10.1145/2673577)

It works most similarly to the implementation proposed in Paxos Made Simple.

The Paxos Node acts simultaneously acts as a Replica, Acceptor, and a Leader. At any time, one Replica will act as the Leader. Some high-level details of the system:

* Upon initialization, a node will read any messages that have been sent before it finished initializing. In normal operation, if a leader has already been elected, one of these messages will be an initialization message from the leader, containing the set of decrees already decided and the current leader's UID. If a leader has not been determined (that is, no node considers itself a leader), the node joining will start a leader election by starting phase 1 of the Paxos protocol. When a leader joins or dies, a new leader election occurs in the same way: some node (or many nodes) will start phase 1, and the node that finishes first is the leader (having gained a promise from a quorum), and will pass a `leader` decree stating so. When multiple nodes begin phase 1 at the same time, ties are broken according to ballot ID, so the node with the largest UID will be the leader (assuming that the integer component of the ballot number is the same).
* Any node will not attempt to pass decrees unless it has learned the previous five decrees.
* When a node joins the system, five 'olive day' decrees are immediately passed
* Each node tracks decrees through three stages: `requests`, `proposals`, and `decisions`. The first two sets are local to the node that is requesting a decree, while the third is global (the ledger in The Part-Time Parliament). `requests` and `proposals` track if a ballot has been initiated for a decree or not (if so, it will be in `proposals`). The leader has an additional set, `leaderProposals`, to seperate the replica and leader components.
* All requests for a decree to be passed are sent to the leader, along with the proposed slot number (or decree number). If the slot number is unused, the leader will initiate phase 2 for the decree, otherwise, it will send the node the decree that was passed.

Initially, I had planned on implementing [Fast Paxos](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/tr-2005-112.pdf), a variant of Paxos where (1) decrees are passed in two message delays and (2) the *state* is kept consistent, but the underlying sequence of operations can differ. However, due to issues with the Quill editor library (requires passing the entire state of the editor rather than a delta of what was changed) and difficulties implementing Fast Paxos (which seems to nearly double the number of corner cases present in Paxos!), I did not implement this.

## Testing

I employed three forms of testing:

* Ad-hoc tests, which consisted of typing in the browser window and checking for correctness in a number of cases (such as the leader dying)
* Command-line tests, which used the Paxos and PaxosMessenger javascript files to test that each component leads to the expected changes (see the `PaxosTests` files, which are manually validated from the console output)
* Tests with failure, which are the above two along side a 'chaos monkey' that would randomly drop 25% of messages.

All tests were for correctness, not performance. All tests ultimately passed, demonstrating that the project works as expected

## Running the project

First, install [nodeJS](https://nodejs.org/en/) and [npm](https://www.npmjs.com/).

Then, clone this repo and the [sever](https://github.com/will-jac/paxos-server), and run:

```{bash}
npm install
npm start
```

from seperate terminals inside the root folder of each project. Then, make sure to open localhost:3000 in *Google Chome*, there is a bug with peerjs in firefox and the project may not work.
