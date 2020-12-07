
import Messenger from './Messenger';

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

class PaxosNode {

    //#region variable declarations
    // Required by all nodes
    uid = null;
    quorumSize = null;
    active = true;

    // Acceptor
    promisedID = null;
    acceptedID = null;
    acceptedDecree = null;

    // Proposer
    decrees = []
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
    //#endregion

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
     * Step 2
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
                Messenger.sendPromise(fromUID, ballotID, this.acceptedID, this.acceptedDecree)
        else if (c === -1) { // ballotID > this.promisedID
            // if (this.pendingPromise === null) {
                this.promisedID = ballotID
                if (this.active)
                    Messenger.sendPromise(fromUID, ballotID, this.acceptedID, this.acceptedDecree)
            //}
        }
        else if (this.active)
            Messenger.sendPrepareNack(fromUID, proposalID, this.promisedID)

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
                Messenger.sendAccepted(ballotID, decree)
        else if (c < 1) { // ballotID >= this.promisedID
            // if (this.pendingAccepted === null) {
                this.promisedID = ballotID;
                this.acceptedID = ballotID;
                this.acceptedDecree = decree;
                if (this.active)
                    Messenger.sendAccepted(ballotID, decree)
            // }
        } else if (this.active) {
            Messenger.sendAcceptNack(fromUID, proposalID, this.promisedID)
        }
    }
    //#endregion

    //#region proposer code
    setDecree(decree) {
        if (this.decree == null) {
            this.decree = decree;
            if (this.isLeader && this.active) {
                Messenger.sendAccept(this.ballotID, decree)
            }
        } else {
            console.log('failed to set decree', decree)
        }
    }
    observeProposal(fromUID, ballotID) {
        if (fromUID != this.proposerUID)
            // ballotID >= {this.nextBallotNum, this.proposerUID})
            if (compareBallotID(ballotID, {num : this.nextBallotNum, uid : this.proposerUID}) < 1)
                this.nextBallotNum += ballotID.num + 1
    }
    /**
     * Step 1: sends a NextBallot message
     * @param {*} incrementProposalNumber
     */
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
            Messenger.sendPrepare(this.ballotID);
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
            Messenger.onLeadershipLost()
            Messenger.onLeadershipChange(this.uid, null)
            this.observeProposal(fromUId, promisedID)
        }
    }
    /**
     * Step 3: send BeginBallot message to all acceptors
     * @param {*} fromUID
     * @param {*} ballotID
     * @param {*} prevAcceptedID
     * @param {*} prevAcceptedDecree
     */
    // TODO: check that this is correct
    recievePromise(fromUID, ballotID, prevAcceptedID, prevAcceptedDecree) {

        pre_leader = this.isLeader

        // basic paxos

        this.observeProposal(fromUID, ballotID)

        // if we're the leader, ignore the promise (?) TODO: check this
        // ignore it if it's for an old proposal or we already have a response for this acceptor
        if (!(this.isLeader || compareBallotID(ballotID, this.ballotID) !== 0 || this.promisesRecieved[fromUID])) {
            this.promisesRecieved.add(fromUID);

            if (prevAcceptedID > this.lastAcceptedID) {
                this.lastAcceptedID = prevAcceptedID;

                if (prevAcceptedDecree !== null)
                    this.decree = prevAcceptedDecree

            }

            if (this.promisesRecieved.length() === this.quorumSize) {
                this.isLeader = true

                Messenger.onLeadershipAcquired()

                if (this.decree !== null && this.active)
                    Messenger.sendAccept(this.ballotID, this.decree)
            }
        }

        // leadersip

        if ((!pre_leader) && this.isLeader) {
            // if we're not the leader before, but we are the leader and after
            oldLeaderUID = this.leaderUID

            this.leaderUID = this.uid
            this.leaderBallotID = this.ballotID
            this.acquiring = false
            this.pulse()
            Messenger.onLeadershipChange(oldLeaderUID, this.uid)
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
                Messenger.onLeadershipLost()
                this.observeProposal(fromUID, ballotID)
            }
            Messenger.onLeadershipChange(oldLeaderUID, fromUID)
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
            Messenger.sendHeartbeat(this.ballotID)
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

            Messenger.onResolution(ballotID, acceptedDecree)
        }
    }
    //#endregion
}

export default PaxosNode