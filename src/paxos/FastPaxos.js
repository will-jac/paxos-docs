
/*
ballotID = {
    uid : null,
    num : null
}
*/

function compareBallotID(bID1, bID2) {
    if (bID1.num < bID2.num)
        return 1
    else if (bID1.num > bID2.num)
        return -1
    else {
        if (bID1.uid < bID2.uid)
            return 1
        else if (bID1.uid > bID2.uid)
            return -1
        else
            return 0
    }
}

messenger = {
    send : (label, data) => {
        // TODO: send the message
    },
    sendPepare : (ballotID) => {
        messenger.send('prepare', [ballotID])
    },
    sendPromise : (proposerUID, ballotID, prevID, prevDecree) => {
        messenger.send('promise', [proposerUID, ballotID, prevID, prevDecree])
    },
    sendAccept : (ballotID, decree) => {
        messenger.send('accept', [ballotID, decree])
    },
    sendAccepted : (ballotID, decree) => {
        messenger.send('accepted', [ballotID, decree])
    },
    onResolution : (ballotID, decree) => {
        messenger.send('resolution', [ballotID, decree])
    },
    sendPrepareNack : (toUID, ballotID, promisedID) => {
        messenger.send('prepareNack', [toUID, ballotID, promisedID])
    },
    sendAcceptNack : (toUID, ballotID, promisedID) => {
        messenger.send('acceptNack', [toUID, ballotID, promisedID])
    },
    onLeadershipAcquired : () => {
        messenger.send('leadershipAcquired')
    },
    onLeadershipLost : () => {
        messenger.send('leadershipLost')
    },
    onLeadershipChange : () => {
        messenger.send('leadershipChange')
    },
    sendHeartbeat : () => {
        messenger.send('heartbeat')
    },
}

// all nodes acceptors
class Acceptor {

    promisedID = null;
    acceptedID = null;
    acceptedDecree = null;

    pendingPromise = null;
    pendingAccepted = null;
    active = true;

    persistance_required(self) {
        return this.pending_promise !== null || this.pendingAccepted !== null
    }

    recover(promisedID, acceptedID, acceptedDecree) {
        this.promisedID = promisedID
        this.acceptedID = acceptedID
        this.acceptedDecree = acceptedDecree
    }

    /**
     * Called when a prepare message is recieved from a proposer
     * @param {*} fromUID
     * @param {*} ballotID
     */
    recievePrepare(fromUID, ballotID) {
        c = compareBallotID(ballotID, this.promisedID)
        if (c === 0)
            // duplicate prepare
            if (this.active)
                messenger.sendPromise(fromUID, ballotID, this.acceptedID, this.acceptedDecree)
        else if (c === -1) { // ballotID > this.promisedID
            if (this.pendingPromise === null) {
                this.promisedID = ballotID
                if (this.active)
                    messenger.sendPromise(fromUID, ballotID, this.acceptedID, this.acceptedDecree)
            }
        }
        else if (this.active)
            messenger.sendPrepareNack(fromUID, proposalID, this.promisedID)
    }
    /**
     * called when an Accept is recieved from a proposer
     * @param {*} fromUID
     * @param {*} ballotID
     * @param {*} decree
     */
    recieveAccept(fromUID, ballotID, decree) {
        c = compareBallotID(ballotID, this.acceptedID)
        if (c === 0 && decree === this.acceptedDecree)
            // duplicate
            if (this.active)
                messenger.sendAccepted(ballotID, decree)
        else if (c < 1) { // ballotID >= this.promisedID
            if (this.pendingAccepted === null) {
                this.promisedID = ballotID;
                this.acceptedID = ballotID;
                this.acceptedDecree = decree;
                if (this.active)
                    messenger.sendAccepted(ballotID, decree)
            }
        } else if (this.active) {
            messenger.sendAcceptNack(fromUID, proposalID, this.promisedID)
        }
    }
    persisted() {
        if (this.active) {
            if (this.pendingPromise) {
                messenger.sendPromise(this.pendingPromise, this.promisedID, this.acceptedID, this.acceptedDecree)
            }
            if (this.pendingAccepted) {
                messenger.sendAccepted(this.acceptedID, this.acceptedDecree)
            }
        }
        this.pendingPromise = null
        this.pendingAccepted = null
    }
}

// all nodes are proposers. Only one is the leader
class Proposer {

    uid = null;
    nextBallotNum = 1;
    lastAcceptedID = null;
    quorumSize = null;
    decree = null;
    ballotID = null;
    promisesRecieved = null;
    isLeader = false;
    active = true;

    setDecree(decree) {
        if (this.decree == null) {
            this.decree = decree;
            if (this.isLeader && this.active) {
                messenger.sendAccept(this.ballotID, decree)
            }
        }
    }

    /**
     * sends a prepare message to all acceptors
     * => acquiring leadership
     */
    prepare(incrementProposalNumber = true) {
        if (incrementProposalNumber) {
            this.promisesRecieved = set();
            this.ballotID = {uid: this.uid, num: this.nextBallotNum};

            ++this.nextBallotNum;
        }
        if (this.active)
            messenger.sendPrepare(this.ballotID);
    }

    observeProposal(fromUID, ballotID) {
        if (fromUID != this.proposerUID)
            if (compareBallotID(ballotID, {num : this.nextBallotNum, uid : this.proposerUID}) < 1) // ballotID >= {this.nextBallotNum, this.proposerUID})
                this.nextBallotNum += ballotID.num + 1
    }

    recievePrepareNack(fromUID, ballotID, promisedID) {
        this.observeProposal(fromUID, promisedID)
    }

    recieveAcceptNack(fromUID, ballotID, promisedID) {}

    resendAccept() {
        if (this.isLeader && this.decree && this.active)
            messenger.sendAccept(this.ballotID, this.decree)
    }

    /**
     * Called when a promise is recieved from an Acceptor
     * @param {*} fromUID
     * @param {*} ballotID
     * @param {*} prevAcceptedId
     * @param {*} prevAcceptedDecree
     */
    recievePromise(fromUID, ballotID, prevAcceptedId, prevAcceptedDecree) {

        this.observeProposal(fromUID, ballotID)

        if (this.isLeader || compareBallotID(ballotID, this.ballotID) !== 0 || fromUID in this.promisesRecieved)
            return;

        this.promisesRecieved.add(fromUID);

        if (prevAcceptedId > this.lastAcceptedID) {
            this.lastAcceptedID = prevAcceptedId;

            if (prevAcceptedDecree !== null)
                this.decree = prevAcceptedDecree

        }

        if (this.promisesRecieved.length() === this.quorumSize) {
            this.isLeader = true

            messenger.onLeadershipAcquired()

            if (this.decree !== null && this.active)
                messenger.sendAccept(this.ballotID, this.decree)
        }
    }
}

// all nodes are learners.
class Learner {

    quorumSize = null

    ballots = null // dictionary mapping {ballotID : [accept, retain, decree]}
    acceptors = null
    finalDecree = null
    finalBallotID = null
    finalAcceptors = null

    complete() {
        return this.finalBallotID !== null
    }

    recieveAccepted(fromUID, ballotID, acceptedDecree) {
        if (this.finalDecree !== null) {
            if (acceptedDecree === this.finalDecree)
                this.finalAcceptors.add(fromUID)
            return
        }

        if (this.ballots === null) {
            this.ballots = {}
            this.acceptors = {}
        }

        lastBallotID = this.acceptors[fromUID]

        // is it an old message?
        if (compareBallotID(ballotID, lastBallotID) < 1) // ballotID <= lastBallotID
            return

        this.acceptors[fromUID] = ballotID

        if (lastBallotID !== null) {
            oldBallot = this.ballots[lastBallotID]
            delete oldBallot[1][fromUID]
            if (oldBallot[1].length === 0) {
                delete this.ballots[lastBallotID]
            }
        }

        if (!this.ballots[ballotID]) { // if it's not in the dictionary
            // acceptors, retainers, decree
            this.ballots[ballotID] = [set(), set(), acceptedDecree]
        }

        t = this.ballots[ballotID]

        if (acceptedDecree !== t[2]) {
            console.log('decree mismatch for ballot... uh oh!!', acceptedDecree, t)
        }

        t[0].add(fromUID)
        t[1].add(fromUID)

        if (t[0].length === this.quorumSize) {
            this.finalDecree = acceptedDecree
            this.finalBallotID = ballotID
            this.finalAcceptors = t[0]
            this.ballots = null
            this.acceptors = null

            messenger.onResolution(ballotID, acceptedDecree)
        }
    }

}

class PaxosNode extends Proposer, Acceptor, Learner {
    // Required by all nodes
    uid = null;
    quorumSize = null;
    active = true;

    // Acceptor
    promisedID = null;
    acceptedID = null;
    acceptedDecree = null;

    // Proposer
    nextBallotNum = 1;
    lastAcceptedID = null;
    decree = null;
    ballotID = null;
    promisesRecieved = null;
    isLeader = false;

    // Learner
    ballots = null // dictionary mapping {ballotID : [accept, retain, decree]}
    acceptors = null
    finalDecree = null
    finalBallotID = null
    finalAcceptors = null

    // used for heartbeat
    period = 1
    window = 5

    timestamp = new Date()

    constructor(uid, quorumSize, leaderUID = null, period = null, window = null) {
        // basic paxos node
        this.uid = uid
        this.proposerUID = uid
        this.quorumSize = quorumSize

        // hearbeat / leadership change
        this.leaderUID = leaderUID
        this.leaderBallotID = {uid: leaderUID, num: 1}
        this.timeLastHB = timestamp.now()
        this.timeLastPrep = timestamp.now()
        this.acquiring = false
        this.nacks = set()

        if (period) this.period = period
        if (window) this.window = window

        // we're the leader! Yay!
        if (this.uid === leaderUID) {
            this.isLeader = true
            this.ballotID = {uid: this.uid, num: this.nextBallotNum}
            ++this.nextBallotNum
        }
    }

    setQuorumSize(size) {
        this.quorumSize = size
    }


    //#region acceptor code
    // TODO: Build in persistent memory and recovery
    /**
     * Called when a prepare message is recieved from a proposer
     * @param {*} fromUID
     * @param {*} ballotID
     */
    recievePrepare(fromUID, ballotID) {
        // basic paxos
        c = compareBallotID(ballotID, this.promisedID)
        if (c === 0)
            // duplicate prepare
            if (this.active)
                messenger.sendPromise(fromUID, ballotID, this.acceptedID, this.acceptedDecree)
        else if (c === -1) { // ballotID > this.promisedID
            if (this.pendingPromise === null) {
                this.promisedID = ballotID
                if (this.active)
                    messenger.sendPromise(fromUID, ballotID, this.acceptedID, this.acceptedDecree)
            }
        }
        else if (this.active)
            messenger.sendPrepareNack(fromUID, proposalID, this.promisedID)

        // heartbeat
        if (fromUID === this.uid) {
            this.timeLastPrep = this.timestamp.now()
        }
    }
    /**
     * called when an Accept is recieved from a proposer
     * @param {*} fromUID
     * @param {*} ballotID
     * @param {*} decree
     */
    recieveAccept(fromUID, ballotID, decree) {
        c = compareBallotID(ballotID, this.acceptedID)
        if (c === 0 && decree === this.acceptedDecree)
            // duplicate
            if (this.active)
                messenger.sendAccepted(ballotID, decree)
        else if (c < 1) { // ballotID >= this.promisedID
            if (this.pendingAccepted === null) {
                this.promisedID = ballotID;
                this.acceptedID = ballotID;
                this.acceptedDecree = decree;
                if (this.active)
                    messenger.sendAccepted(ballotID, decree)
            }
        } else if (this.active) {
            messenger.sendAcceptNack(fromUID, proposalID, this.promisedID)
        }
    }
    //#endregion

    //#region proposer code
    setDecree(decree) {
        if (this.decree == null) {
            this.decree = decree;
            if (this.isLeader && this.active) {
                messenger.sendAccept(this.ballotID, decree)
            }
        }
    }
    observeProposal(fromUID, ballotID) {
        if (fromUID != this.proposerUID)
            // ballotID >= {this.nextBallotNum, this.proposerUID})
            if (compareBallotID(ballotID, {num : this.nextBallotNum, uid : this.proposerUID}) < 1)
                this.nextBallotNum += ballotID.num + 1
    }
    prepare(incrementProposalNumber = true) {
        // optimization
        this.nacks = Set()
        // basic paxos
        // TODO: check if this is correct
        // incrementProposalNumber is used for leadership
        if (incrementProposalNumber) {
            this.promisesRecieved = set();
            this.ballotID = {uid: this.uid, num: this.nextBallotNum};

            ++this.nextBallotNum;
        }
        if (this.active)
            messenger.sendPrepare(this.ballotID);
    }
    recievePrepareNack(fromUID, ballotID, promisedID) {
        // basic paxos
        this.observeProposal(fromUID, promisedID)

        // leadership
        if (this.acquiring)
            this.prepare()
    }
    recieveAcceptNack(fromUID, ballotID, promisedID) {
        // all leadership stuff
        if (compareBallotID(ballotID, this.ballotID) === 0)
            this.nacks.add(fromUID)

        if (this.isLeader && this.nacks.length >= this.quorumSize) {
            this.isLeader = false
            this.promisesRecieved = Set()
            this.leaderUID = null
            this.leaderBallotID = null
            messenger.onLeadershipLost()
            messenger.onLeadershipChange(this.uid, null)
            this.observeProposal(fromUId, promisedID)
        }
    }
    recievePromise(fromUID, ballotID, prevBallotID, prevDecree) {

        pre_leader = this.isLeader

        // basic paxos

        this.observeProposal(fromUID, ballotID)

        if (this.isLeader || compareBallotID(ballotID, this.ballotID) !== 0 || fromUID in this.promisesRecieved)
            return;

        this.promisesRecieved.add(fromUID);

        if (prevAcceptedId > this.lastAcceptedID) {
            this.lastAcceptedID = prevAcceptedId;

            if (prevAcceptedDecree !== null)
                this.decree = prevAcceptedDecree

        }

        if (this.promisesRecieved.length() === this.quorumSize) {
            this.isLeader = true

            messenger.onLeadershipAcquired()

            if (this.decree !== null && this.active)
                messenger.sendAccept(this.ballotID, this.decree)
        }

        // leadersip

        if ((!pre_leader) && this.isLeader) {
            // if we're not the leader before, but we are the leader and after
            oldLeaderUID = this.leaderUID

            this.leaderUID = this.uid
            this.leaderBallotID = this.ballotID
            this.acquiring = false
            this.pulse()
            messenger.onLeadershipChange(oldLeaderUID, this.uid)
        }
    }

    //#region leadership code
    leaderIsAlive() {
        return this.timestamp.now() - this.timeLastHB <= this.window
    }
    observedRecentPrepare() {
        this.timestamp() - this.timeLastPrep <= this.window * 1.5
    }
    pollLeader() {
        if (!this.leaderIsAlive() && !this.observedRecentPrepare())
            if (this.acquiring)
                this.prepare()
            else
                this.acquireLeadership()
    }
    recieveHeartbeat(fromUID, ballotID) {
        c = compareBallotID(ballotID, this.leaderBallotID)
        if (c === -1) { // ballotID < this.leaderBallotID
            // new leader!
            this.acquiring = false
            oldLeaderUID = this.leaderUID
            this.leaderUID = fromUID
            this.leaderBallotID = ballotID
            if (this.isLeader && fromUID != this.uid) {
                this.isLeader = false
                messenger.onLeadershipLost()
                this.observeProposal(fromUID, ballotID)
            }
            messenger.onLeadershipChange(oldLeaderUID, fromUID)
        }
        if (c === 0) {
            // no leader change
            this.timeLastHB = timestamp.now()
        }
    }
    pulse() {
        if (this.isLeader) {
            // confirm we're still the leader
            this.recieveHeartbeat(this.uid, this.ballotID)
            // tell everyone we're still the leader
            messenger.sendHeartbeat(this.ballotID)
            // call this function again after a sleep
            setTimeout(this.pulse, this.period * 1000)
        }
    }
    acquireLeadership() {
        // leader died -> assert that we are now the leader
        if (this.leaderIsAlive())
            this.acquiring = false
        else {
            this.acquiring = true
            this.prepare()
        }
    }
    //#endregion
    //#endregion

    //#region learner code
    complete() {
        return this.finalBallotID !== null
    }
    recieveAccepted(fromUID, ballotID, acceptedDecree) {
        if (this.finalDecree !== null) {
            if (acceptedDecree === this.finalDecree)
                this.finalAcceptors.add(fromUID)
            return
        }

        if (this.ballots === null) {
            this.ballots = {}
            this.acceptors = {}
        }

        lastBallotID = this.acceptors[fromUID]

        // is it an old message?
        if (compareBallotID(ballotID, lastBallotID) < 1) // ballotID <= lastBallotID
            return

        this.acceptors[fromUID] = ballotID

        if (lastBallotID !== null) {
            oldBallot = this.ballots[lastBallotID]
            delete oldBallot[1][fromUID]
            if (oldBallot[1].length === 0) {
                delete this.ballots[lastBallotID]
            }
        }

        if (!this.ballots[ballotID]) { // if it's not in the dictionary
            // acceptors, retainers, decree
            this.ballots[ballotID] = [set(), set(), acceptedDecree]
        }

        t = this.ballots[ballotID]

        if (acceptedDecree !== t[2]) {
            console.log('decree mismatch for ballot... uh oh!!', acceptedDecree, t)
        }

        t[0].add(fromUID)
        t[1].add(fromUID)

        if (t[0].length === this.quorumSize) {
            this.finalDecree = acceptedDecree
            this.finalBallotID = ballotID
            this.finalAcceptors = t[0]
            this.ballots = null
            this.acceptors = null

            messenger.onResolution(ballotID, acceptedDecree)
        }
    }
    //#endregion
}