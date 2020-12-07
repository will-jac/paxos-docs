
/*
ballotID = {
    uid : null,
    num : null
}
*/

function compareBallotID(ballotID1, ballotID2) {
    if (!ballotID1 || !ballotID2)
        if (ballotID1)
            return -1
        else if (!ballotID2)
            return -1
        else
            return 0
    else if (ballotID1.num < ballotID2.num)
        return 1
    else if (ballotID1.num > ballotID2.num)
        return -1
    else {
        if (ballotID1.uid < ballotID2.uid)
            return 1
        else if (ballotID1.uid > ballotID2.uid)
            return -1
        else
            return 0
    }
}

class PaxosNode {

    constructor(period = null, window = null) {
        console.log('constructor')
        this.timeLastHB = Date.now()
        this.timeLastPrep = Date.now()
        this.acquiring = false
        this.nacks = new Set()

        // Required by all nodes
        this.uid = null
        this.quorumSize = 1
        this.active = true

        // Acceptor
        this.promisedID = null;
        this.acceptedID = null;
        this.acceptedDecree = null;

        // Proposer
        this.decrees = [];
        this.nextBallotNum = 1;
        this.lastAcceptedID = null;
        this.decree = null;
        this.ballotID = null;
        this.promisesRecieved = null;
        this.isLeader = false;

        // Learner
        this.ballots = null; // dictionary mapping {ballotID : [accept, retain, decree]}
        this.acceptors = null;
        this.finalDecree = null;
        this.finalBallotID = null;
        this.finalAcceptors = null;

        // used for heartbeat
        this.period = 1
        this.window = 5

        // used to send messages
        this.messenger = null;

        if (period) this.period = period
        if (window) this.window = window


        // function bind to this
        this.setup = this.setup.bind(this);
        this.setid = this.setid.bind(this);
        this.setMessenger = this.setMessenger.bind(this);
        this.setQuorumSize = this.setQuorumSize.bind(this);
        this.recievePrepare = this.recievePrepare.bind(this);
        this.recieveAccept = this.recieveAccept.bind(this);
        this.setDecree = this.setDecree.bind(this);
        this.observeProposal = this.observeProposal.bind(this);
        this.prepare = this.prepare.bind(this);
        this.recievePrepareNack = this.recievePrepareNack.bind(this);
        this.recieveAcceptNack = this.recieveAcceptNack.bind(this);
        this.recievePromise = this.recievePromise.bind(this);
        this.leaderIsAlive = this.leaderIsAlive.bind(this);
        this.observedRecentPrepare = this.observedRecentPrepare.bind(this);
        this.pollLeader = this.pollLeader.bind(this);
        this.recieveHeartbeat = this.recieveHeartbeat.bind(this);
        this.pulse = this.pulse.bind(this);
        this.acquireLeadership = this.acquireLeadership.bind(this);
        this.complete = this.complete.bind(this);
        this.recieveAccepted = this.recieveAccepted.bind(this);
    }
    setup(uid, quorumSize, leaderUID = null, period = null, window = null) {
        console.log('setup')
        // basic paxos node
        this.uid = uid
        this.proposerUID = uid
        this.quorumSize = quorumSize

        // hearbeat / leadership change
        this.leaderUID = leaderUID
        this.leaderBallotID = {uid: leaderUID, num: 1}
        this.timeLastHB = Date.now()
        this.timeLastPrep = Date.now()
        this.acquiring = false
        this.nacks = new Set()

        if (period) this.period = period
        if (window) this.window = window

        // we're the leader! Yay!
        if (this.uid === leaderUID) {
            this.isLeader = true
            this.ballotID = {uid: this.uid, num: this.nextBallotNum}
            ++this.nextBallotNum
        }
    }
    setid(uid) {
        // basic paxos node
        this.uid = uid
        this.proposerUID = uid
        this.quorumSize = 1

        // hearbeat / leadership change
        this.leaderUID = uid
        this.leaderBallotID = {uid: this.leaderUID, num: 1}
        this.timeLastHB = Date.now()
        this.timeLastPrep = Date.now()
        this.acquiring = false
        this.nacks = new Set()

        // we're the leader! Yay! (auto assume that we're the leader)
        if (this.uid === this.leaderUID) {
            this.isLeader = true
            this.ballotID = {uid: this.uid, num: this.nextBallotNum}
            ++this.nextBallotNum
        }


        console.log(this.uid, this.active, this.quorumSize)
    }
    setMessenger(m) {
        console.log('set messenger', m)
        this.messenger = m
    }
    setQuorumSize(size) {
        console.log('set quorum size', size)
        this.quorumSize = size
    }

    //#region acceptor code
    // TODO: Build in persistent memory and recovery
    /**
     * Step 2
     * Phase 1b: send a promise
     * Called when a prepare message is recieved from a proposer
     * @param {*} fromUID
     * @param {*} ballotID
     */
    recievePrepare(fromUID, ballotID) {
        console.log('recv prepare', fromUID, ballotID, this.active)
        // basic paxos
        var c = compareBallotID(ballotID, this.promisedID)
        if (c === 0) {
            // duplicate prepare
            if (this.active)
                this.messenger.sendPromise(fromUID, ballotID, this.acceptedID, this.acceptedDecree)
        }
        else if (c === -1) { // ballotID > this.promisedID
            // if (this.pendingPromise === null) {
                this.promisedID = ballotID
                if (this.active)
                    this.messenger.sendPromise(fromUID, ballotID, this.acceptedID, this.acceptedDecree)
            //}
        }
        else if (this.active) {
            this.messenger.sendPrepareNack(fromUID, ballotID, this.promisedID)
        }
        else {
            console.log('recv prepare: else triggered', c, this.active)
        }

        // heartbeat
        if (fromUID === this.uid) {
            this.timeLastPrep = Date.now()
        }
    }
    /**
     * Step 4: votings
     * called when an Accept is recieved from a proposer
     * @param {*} fromUID
     * @param {*} ballotID
     * @param {*} decree
     */
    recieveAccept(fromUID, ballotID, decree) {
        console.log('recv accept', fromUID, ballotID, decree)
        var c = compareBallotID(ballotID, this.acceptedID)
        if (c === 0 && decree === this.acceptedDecree) {
            console.log('duplicate')
            // duplicate
            if (this.active) {
                this.messenger.sendAccepted(ballotID, decree)
            }
        } else if (c < 1) { // ballotID >= this.promisedID
            // if (this.pendingAccepted === null) {
                console.log('c < 1')
                this.promisedID = ballotID;
                this.acceptedID = ballotID;
                this.acceptedDecree = decree;
                if (this.active) {
                    this.messenger.sendAccepted(ballotID, decree)
                }
            // }
        } else if (this.active) {
            this.messenger.sendAcceptNack(fromUID, ballotID, this.promisedID)
        } else {
            console.log('doing nothing')
        }
    }
    //#endregion

    //#region proposer code
    setDecree(decree) {
        if (this.decree == null) {
            this.decree = decree;
            if (this.isLeader && this.active) {
                // ??
                this.messenger.sendAccept(this.ballotID, decree)
            }
        } else {
            console.log('failed to set decree', decree)
        }
    }
    observeProposal(fromUID, ballotID) {
        if (fromUID !== this.uid) {
            // ballotID >= {this.nextBallotNum, this.uid})
            var c = compareBallotID(ballotID, {num : this.nextBallotNum, uid : this.uid})
            if (c < 1)
                this.nextBallotNum += ballotID.num + 1
            return c
        }
        return null
    }
    /**
     * Step 1: sends a NextBallot message
     * Phase 1a: send a Prepare
     * @param {*} incrementProposalNumber
     */
    prepare(incrementProposalNumber = true) {
        console.log('prepare', this.active, this.uid)
        // optimization
        this.nacks = new Set()
        // basic paxos
        // TODO: check if this is correct
        // incrementProposalNumber is used for leadership
        if (incrementProposalNumber) {
            this.promisesRecieved = new Set();
            this.ballotID = {uid: this.uid, num: this.nextBallotNum};

            ++this.nextBallotNum;
        }
        if (this.active)
            this.messenger.sendPrepare(this.ballotID);
    }
    recievePrepareNack(fromUID, ballotID, promisedID) {
        console.log('recv prepare NACK', fromUID, ballotID, promisedID)
        // basic paxos
        this.observeProposal(fromUID, promisedID)

        // leadership
        if (this.acquiring)
            this.prepare()
    }
    recieveAcceptNack(fromUID, ballotID, promisedID) {
        console.log('recv accept NACK', fromUID, ballotID, promisedID)
        // all leadership stuff
        if (compareBallotID(ballotID, this.ballotID) === 0)
            this.nacks.add(fromUID)

        if (this.isLeader && this.nacks.size >= this.quorumSize) {
            this.isLeader = false
            this.promisesRecieved = new Set()
            this.leaderUID = null
            this.leaderBallotID = null
            this.messenger.onLeadershipLost()
            this.messenger.onLeadershipChange(this.uid, null)
            this.observeProposal(fromUID, promisedID)
        }
    }
    /**
     * Step 3: send BeginBallot message to all acceptors
     * Phase 2a: Accept
     * @param {*} fromUID
     * @param {*} ballotID
     * @param {*} prevAcceptedID
     * @param {*} prevAcceptedDecree
     */
    // TODO: check that this is correct
    recievePromise(fromUID, ballotID, prevAcceptedID, prevAcceptedDecree) {
        console.log('recv promise', fromUID, ballotID, prevAcceptedID, prevAcceptedDecree)
        var pre_leader = this.isLeader

        // basic paxos

        // if another leader is sending proposals around, observe it and increment the next ballot num
        this.observeProposal(fromUID, ballotID)

        // if we're the leader, ignore the promise (?) TODO: check this
        // ignore it if it's for an old proposal or we already have a response for this acceptor
        var c = compareBallotID(ballotID, this.ballotID)
        console.log(this.isLeader, c)
        if (!(!this.isLeader || c !== 0 || this.promisesRecieved[fromUID])) {
            console.log('if triggered')
            this.promisesRecieved.add(fromUID);

            if (prevAcceptedID > this.lastAcceptedID) {
                this.lastAcceptedID = prevAcceptedID;

                if (prevAcceptedDecree !== null)
                    this.decree = prevAcceptedDecree

            }

            if (this.promisesRecieved.size === this.quorumSize) {
                console.log('reached quorum')
                this.isLeader = true

                this.messenger.onLeadershipAcquired()

                if (this.decree !== null && this.active)
                    this.messenger.sendAccept(this.ballotID, this.decree)
            }
        }

        // leadersip

        if ((!pre_leader) && this.isLeader) {
            console.log('not leader -> leader')
            // if we're not the leader before, but we are the leader and after
            var oldLeaderUID = this.leaderUID

            this.leaderUID = this.uid
            this.leaderBallotID = this.ballotID
            this.acquiring = false
            this.pulse()
            this.messenger.onLeadershipChange(oldLeaderUID, this.uid)
        }
    }

    //#region leadership code
    leaderIsAlive() {
        return Date.now() - this.timeLastHB <= this.window
    }
    observedRecentPrepare() {
        return Date.now() - this.timeLastPrep <= this.window * 1.5
    }
    pollLeader() {
        if (!this.leaderIsAlive() && !this.observedRecentPrepare())
            if (this.acquiring)
                this.prepare()
            else
                this.acquireLeadership()
    }
    recieveHeartbeat(fromUID, ballotID) {
        console.log('recv heartbeat')

        var c = compareBallotID(ballotID, this.leaderBallotID)
        if (c === -1) { // ballotID < this.leaderBallotID
            // new leader!
            this.acquiring = false
            var oldLeaderUID = this.leaderUID
            this.leaderUID = fromUID
            this.leaderBallotID = ballotID
            if (this.isLeader && fromUID !== this.uid) {
                this.isLeader = false
                this.messenger.onLeadershipLost()
                this.observeProposal(fromUID, ballotID)
            }
            this.messenger.onLeadershipChange(oldLeaderUID, fromUID)
        }
        if (c === 0) {
            // no leader change
            this.timeLastHB = Date.now()
        }
    }
    pulse() {
        if (this.isLeader) {
            // confirm we're still the leader
            this.recieveHeartbeat(this.uid, this.ballotID)
            // tell everyone we're still the leader
            this.messenger.sendHeartbeat(this.ballotID)
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
        console.log('recv accepted', fromUID, ballotID, acceptedDecree)
        if (this.finalDecree !== null) {
            if (acceptedDecree === this.finalDecree)
                this.finalAcceptors.add(fromUID)
            return
        }

        if (this.ballots === null) {
            console.log("null ballots")
            this.ballots = {}
            this.acceptors = {}
        }

        var lastBallotID = this.acceptors[fromUID]

        // is it an old message?
        if (compareBallotID(ballotID, lastBallotID) > -1) {// ballotID <= lastBallotID
            console.log('old ballot')
            return
        }

        this.acceptors[fromUID] = ballotID

        if (lastBallotID) {
            console.log(lastBallotID)
            var oldBallot = this.ballots[lastBallotID]
            delete oldBallot[1][fromUID]
            if (oldBallot[1].size === 0) {
                delete this.ballots[lastBallotID]
            }
        }

        if (!this.ballots[ballotID]) { // if it's not in the dictionary
            console.log('!this.ballots[ballotID]')
            // acceptors, retainers, decree
            this.ballots[ballotID] = [new Set(), new Set(), acceptedDecree]
        }

        var t = this.ballots[ballotID]

        if (acceptedDecree !== t[2]) {
            console.log('decree mismatch for ballot... uh oh!!', acceptedDecree, t)
        }

        t[0].add(fromUID)
        t[1].add(fromUID)

        if (t[0].size === this.quorumSize) {
            console.log('reached quorum')
            this.finalDecree = acceptedDecree
            this.finalBallotID = ballotID
            this.finalAcceptors = t[0]
            this.ballots = null
            this.acceptors = null

            this.messenger.onResolution(ballotID, acceptedDecree)
        }
    }
    //#endregion
}

export default PaxosNode