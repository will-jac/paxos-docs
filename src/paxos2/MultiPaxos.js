
class PaxosNode {
    constructor() {
        // Replica
        this.slot_in = 0
        this.slot_out = 0

        this.proposals = new Set();

        this.quorumSize = 1

        // Proposer
        this.nacks = null;
        this.promisesRecieved = null;

        this.nextBallotNum = 1;
        this.ballotID = {num: this.nextBallotNum, uid: this.uid};

        this.decree = null;

        this.requests = [];
        this.decisions = new Set();

        this.isLeader = true;
        this.acquiring = false;
        this.leaderUID = this.uid;

        this.period = 2
        //TODO: leadership

        // Leader
        this.accept = [];

        // Acceptor
        this.promisedID = null
        this.acceptedID = null
        this.acceptedDecree = null

        // Learner
        this.ballots = null
    }
    onLeaderChange(x) {
        // do nothing (gets overridden by editor)
        console.log("doing nothing, fun not overridden", x)
    }
    send () {
        console.log('send', arguments)
    }
    setQuorumSize(size, uidJoinedOrDied) {
        console.log('quorum size is:', size)
        this.quorumSize = size
        if (uidJoinedOrDied === this.leaderUID) {
            this.acquiring = true
            this.acquireLeadership()
        }
    }
    updateNewUser(uid) {
        // if (this.decree !== null) {
        //     this.send('init', uid, this.acceptedID, this.decree)
        // }
    }
    recvUpdate(uid, acceptedID, decree) {
       // this.recvAccepted(uid, acceptedID, decree)
    }
    /**
     * Called by client (w/o message delay)
     * If this were decoupled on the client, this would be exported
     *
     * Start a fast round by bcasting a P2a message (Accept) to every node
     *
     * @param {*} decree
     */
    fastRound(decree) {
        this.send('accept', null, decree)
    }

    //#region Proposer
    setDecree(decree) {
        // TODO: slots
        if (this.decree === null) {
            this.decree = decree
        } else {
            this.requests.push(decree)
        }
    }
    /**
     * This should be called once per leader
     * Phase 1a
     * (implicit leadership acquisition)
     * @param {boolean} incrementProposalNumber
     */
    prepare(incrementProposalNumber = true) {
        this.nacks = new Set();

        if (incrementProposalNumber) {
            this.promisesRecieved = new Set();
            this.ballotID = this.nextBallotNum
            ++this.nextBallotNum;
        }

        this.isLeader = true;
        this.onLeaderChange(this.isLeader)
        //console.log('send prepare', this.ballotID);
        this.send('prepare',this.ballotID);
    }
    /**
     * Prepare NACK means that our ballotID wasn't big enough
     * -> preempted in paxos made moderately complex
     * @param {*} fromUID
     * @param {*} ballotID
     * @param {*} promisedID
     */
    recvPrepareNack(fromUID, ballotID, promisedID) {
        console.log('recv prepare NACK', fromUID, ballotID, promisedID)

        // if we didn't send it and it's past our own ballotNum, advance our ballotNum
        if (fromUID !== this.uid) {
            if (ballotID >= this.nextBallotNum) {
                // {num: this.nextBallotNum, uid: this.uid}) < 1) {
                this.nextBallotNum += ballotID.num + 1
                // this.isLeader = false
            }
        }

        // prepare Nack -> someone else is sending prepares around. Start aqcuiring leadership
        // TODO
        // if (this.acquiring)
            // this.prepare()
        this.acquireLeadership()
    }
    /**
     * Step 3: send BeginBallot message to all acceptors
     * Phase 2a: when we get an Accept from ` all in the quorum, send accepted
     *
     * -> adopted message in paxos made moderately complex
     * @param {*} fromUID
     * @param {*} ballotID
     * @param {*} prevAcceptedID
     * @param {*} precAcceptedDecree
     */
    recvPromise(fromUID, ballotID, prevAcceptedID, prevAcceptedDecree) {
        console.log('recv promise', fromUID, ballotID, prevAcceptedID, prevAcceptedDecree)

        // if someone else is passing messages around, see if we need to increment our ballotNum
        if (fromUID !== this.uid && ballotID >= this.nextBallotNum)
            this.nextBallotNum += ballotID.num + 1

        // it's for the right ballot and we don't have it in the map yet
        if (ballotID === this.ballotID && !this.promisesRecieved[fromUID]) {
            this.promisesRecieved.add(fromUID);

            if (prevAcceptedID > this.lastAcceptedID) {
                this.lastAcceptedID = prevAcceptedID;

                if (prevAcceptedDecree !== null)
                    this.decree = prevAcceptedDecree
            }

            if (this.promisesRecieved.size === this.quorumSize) {
                // determine slot numbers & populate proposals
                // if (!this.prevMax[prevSlotNum] || this.prevMax[prevSlotNum] < prevAcceptedID) {
                //     this.prevMax[prevSlotNum] = prevAcceptedID
                //     this.proposals[prevSlotNum] = prevAcceptedDecree
                // }
                // // span commander
                // for (var ballot in this.proposals) {
                // }

                this.leaderOnAdopted(this.ballotID, )
            }
        }
    }

//#region Paxos made moderately complex
    propose() {
        // iterate through the requests
        while (this.requests.length != 0 && this.slot_in < this.slot_out + PaxosNode.window) {
            // if (this.slot_in > PaxosNode.window && this.slot_in - PaxosNode.window in this.decisions) {
            //     // TODO: decisions
            //     // TODO: reconfigure command
            // }
            // if we haven't already decided one
            if (!this.decisions[this.slot_in]) {
                var decree = this.requests.shift()
                this.proposals[this.slot_in] = decree
                this.send('propose', this.leaderUID, this.slot_in, decree)
            }
            ++this.slot_in
        }
    }
    // Unnecessary as the proposer isn't actually performing the decree
    perform(decree) {
        for (var i = 1; i < this.slot_out; ++i) {
            if (JSON.stringify(this.decisions[i]) === JSON.stringify(decree)) {
                ++this.slot_out
                return
            }
        }
        // TODO: reconfigure command

        // this is what the learner code is doing

        // TODO: perform command
        ++this.slot_out
    }

    // entry point: call replica with msg.type="request", msg.decree set
    // else: msg must have slot_num, type, decree
    replica(msg) {
        if (msg.type === 'request') {
            this.requests.push(msg.decree)
        } else if (msg.type === 'decision') {
            this.requests[msg.slot_num] = msg.decree
            while (this.slot_out in this.decisions) {
                if (this.slot_out in this.proposals) {
                    if (this.proposals[this.slot_out] !== this.decisions[this.slot_out]) {
                        this.requests.append(this.proposals[this.slot_out])
                    }
                    delete this.proposals[this.slot_out]
                }
                // this.perform(this.decisions[this.slot_out])
            }
        }
        this.propose()
    }
    // called when P1 is complete
    leaderOnAdopted(ballotID, accepted) {
        if (this.ballotID === ballotID) {
            var pmax = {}
            for (var pv in accepted) {
                if (!(pv.slot_num in pmax) || (pmax[pv.slot_num] < pv.ballotID)) {
                    pmax[pv.slot_num] = pv.ballotID
                    this.proposals[pv.slot_num] = pv.decree
                }
            }
            for (var slot_num in this.proposals) {
                this.send('accept', this.ballotID, this.proposals[slot_num])
                this.accept[slot_num].acceptors = new Set()
                this.accept[slot_num].decree = this.proposals[slot_num]
            }
            this.isLeader = true
            this.onLeaderChange(this.isLeader)
        }
    }
    // Initiates P2 (leader's entry for fast paxos)
    recvPropose(fromUID, slot_num, decree) {
        if (!this.proposals[slot_num]) {
            this.proposals[slot_num] = decree
            if (this.isLeader) {
                // TODO: spawn commander
                this.send('accept',this.ballotID, this.decree)
                this.accept[this.ballotID] = new Set()
                this.accept[this.ballotID]['decree'] = this.decree
                ++this.ballotID;
            }
        }

    }
    leader(msg) {
        if (msg.type === 'adopted') {

        } else if (msg.type === 'preempted') {
            if (msg.ballotID > this.ballotID) {
                this.ballotID = msg.ballotID + 1
                // spawn scout
            }
            this.isLeader = false
            this.onLeaderChange(this.isLeader)
        }
    }
//#endregion

    addDecreeToQueue(decree) {
        if (this.nacks === null && this.decree === null) {
            // need to prepare
            this.decree = decree
            this.acquireLeadership()

        } else {
            console.log('addDecreeToQueue', decree)
            this.requests.push(decree)

            if (this.requests.length >= 1 && this.decree === null) {
                this.startPhase2()
            }
        }
    }
    /**
     * Called after a success message when the node is the leader
     * Starts the next ballot immediately
     */
    startPhase2() {
        console.log('start phase 2', this.isLeader)
        if (this.isLeader && this.requests.length > 0) {
            this.decree = this.requests.shift(); // pop the first element
            this.ballotID = this.nextBallotNum;
            ++this.nextBallotNum;
            this.send('accept',this.ballotID, this.decree);
            // TODO: combine with the Accepted message
        }
    }
    /**
     * on accept nack, we have a ballotID or decree conflict
     * eg: someone else sent a ballot with the same number and same decree,
     * or the acceptor already promised a larger ballot
     * @param {*} fromUID
     * @param {*} ballotID
     * @param {*} promisedID
     */
    recvAcceptNack(fromUID, ballotID, promisedID) {
        console.log('recv accept NACK', fromUID, ballotID, promisedID)

        if (ballotID === this.ballotID)
            this.nacks.add(fromUID)

        if (this.isLeader && this.nacks.size >= this.quorumSize) {
            this.isLeader = false
            this.onLeaderChange(this.isLeader)
            this.promisesRecieved = new Set()
            this.leaderUID = null
            this.leaderBallotID = null
            // we aren't the leader, probably
            // TODO
            // this.messenger.whoIsLeader()
            //this.observeProposal(fromUID, promisedID)
            if (fromUID !== this.uid) {
                this.nextBallotNum = promisedID + 1
            }
        }
    }
    //#endregion
    //#region Acceptor
    /**
     * Phase 1b: send a promise
     * @param {BallotID} ballotID
     */
    recvPrepare(fromUID, ballotID) {
        console.log('recv prepare', fromUID, ballotID);

        if (ballotID >= this.promisedID) {
            // update our own ballotID in case we need to be the leader later
            this.nextBallotNum = ballotID + 1
            this.promisedID = ballotID
            this.send('promise',fromUID, ballotID, this.acceptedID, this.acceptedDecree)
        }
        else {
            this.send('prepareNack',fromUID, ballotID, this.promisedID)
        }
    }
    /**
     * Step 4: voting
     * Phase 2b: called when an accept is recieved from a proposer
     *
     * This is the entry point for Fast Paxos
     *
     * @param {*} fromUID
     * @param {*} ballotID
     * @param {*} decree
     */
    recvAccept(fromUID, ballotID, decree) {
        console.log('recv accept', fromUID, ballotID, decree);

        if (ballotID === null) {
            // fast round
            this.promisedID = ballotID;
            this.acceptedID = ballotID;
            this.acceptedDecree = decree;
            this.send('accepted',null, decree)
        }

        // TODO: use c structs here
        // TODO do stuff with slots
        if (ballotID === this.promisedID && decree === this.acceptedDecree) {
            // duplicate
            this.send('accepted',ballotID, decree);
        } else if (ballotID >= this.promisedID) { // ballotID >= promisedID
            this.promisedID = ballotID;
            this.acceptedID = ballotID;
            this.acceptedDecree = decree;
            this.send('accepted',ballotID, decree);
        } else {
            this.send('acceptNack',fromUID, ballotID, this.promisedID)
        }
    }
    //#endregion
    //#region Learner (and leader)
    recvAccepted(fromUID, ballotID, acceptedDecree) {
        console.log('recv accepted', fromUID, ballotID, acceptedDecree)

        // If we haven't reached a quorum yet
        if (this.finalDecree !== null) {
            if (acceptedDecree === this.finalDecree) {
                this.finalAcceptors.add(fromUID)
                return
            }
        }
        if (this.ballots === null) {
            this.ballots = {}
            this.acceptors = {}
        }
        var lastBallotID = this.acceptors[fromUID]
        // is it an old message?
        if (ballotID <= lastBallotID) {
            console.log('old ballot')
            return
        }

        this.acceptors[fromUID] = ballotID
        if (lastBallotID) {
            var oldBallot = this.ballots[lastBallotID]
            delete oldBallot[1][fromUID]
            if (oldBallot[1].size === 0) {
                delete this.ballots[lastBallotID]
            }
        }

        // if it's not in the dictionary
        if (!this.ballots[ballotID]) {
            console.log('!this.ballots[ballotID]')
            // acceptors, retainers, decree
            this.ballots[ballotID] = [new Set(), new Set(), acceptedDecree]
        }

        var t = this.ballots[ballotID]

        if (JSON.stringify(acceptedDecree) !== JSON.stringify(t[2])) {
            console.log('decree mismatch for ballot... uh oh!!', acceptedDecree, t[2])
            return
        }

        t[0].add(fromUID)
        t[1].add(fromUID)

        if (t[0].size === this.quorumSize) {
            console.log('reached quorum', this.quorumSize)
            this.finalDecree = acceptedDecree
            this.finalBallotID = ballotID
            this.finalAcceptors = t[0]
            this.ballots = null
            this.acceptors = null

            if (acceptedDecree && acceptedDecree.type === 'leader') {
                this.leaderUID = acceptedDecree.leaderUID
                console.log('leader is:', this.leaderUID)

                this.isLeader = this.leaderUID === this.uid
                // for the crown display
                this.onLeaderChange(this.isLeader)

                this.acquiring = false

                if (this.isLeader) {
                    this.pulse();
                }
            }

            if (this.isLeader) {
                this.decree = null;
                this.startPhase2()
            }

            if (acceptedDecree && acceptedDecree.type !== 'leader') {
                this.onResolution(acceptedDecree)
            }
        }
    }
    //#endregion

    //#region leadership code
    leaderIsAlive() {
        return Date.now() - this.timeLastHB <= this.window
    }
    observedRecentPrepare() {
        return Date.now() - this.timeLastPrep <= this.window * 1.5
    }
    pollLeader() {
        console.log('polling leader', this.leaderIsAlive(), this.observedRecentPrepare())
        if (!this.leaderIsAlive() && !this.observedRecentPrepare())
            if (this.acquiring)
                this.prepare()
            else if (this.leaderIsAlive())
                this.acquiring = false
            else
                this.acquireLeadership()
    }
    recvHeartbeat(fromUID, ballotID) {
        //console.log('recv heartbeat')

        if ( fromUID !== this.leaderUID) {//ballotID < this.leaderBallotID) { // ballotID < this.leaderBallotID
            // new leader!
            this.acquiring = false
            // var oldLeaderUID = this.leaderUID
            this.leaderUID = fromUID
            this.leaderBallotID = ballotID
            if (this.isLeader && fromUID !== this.uid) {
                this.isLeader = false
                this.onLeaderChange(this.isLeader)
                //this.messenger.onLeadershipLost()
                //this.observeProposal(fromUID, ballotID)
                this.nextBallotNum = ballotID + 1
            }
            //this.messenger.onLeadershipChange(oldLeaderUID, fromUID)
        }
        else { //if ( ballotID === this.leaderBallotID) {
            // no leader change
            this.timeLastHB = Date.now()
        }
    }
    pulse() {
        if (this.isLeader) {
            // confirm we're still the leader
            this.recvHeartbeat(this.uid, this.ballotID)
            // tell everyone we're still the leader
            this.send('heartbeat', this.ballotID)
            // call this function again after a sleep for 1 second
            setTimeout(this.pulse.bind(this), 1000)
        }
    }
    acquireLeadership() {
        console.log('acquiring leadership')
        // leader died -> assert that we are now the leader
        this.acquiring = true
        // sideline the current decree
        this.requests.unshift(this.decree)
        // now, pass a leader decree
        this.decree = {
            type: 'leader',
            leaderUID: this.uid
        }
        this.prepare()
    }
    //#endregion
}

export default PaxosNode