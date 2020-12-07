function compareBallotID(ballotID1, ballotID2) {
    if (ballotID1 < ballotID2) return 1
    else if (ballotID1 > ballotID2) return -1
    return 0
    // if (!ballotID1 || !ballotID2)
    //     if (ballotID1)
    //         return -1
    //     else if (!ballotID2)
    //         return -1
    //     else
    //         return 0
    // else if (ballotID1.num < ballotID2.num)
    //     return 1
    // else if (ballotID1.num > ballotID2.num)
    //     return -1
    // else {
    //     if (ballotID1.uid < ballotID2.uid)
    //         return 1
    //     else if (ballotID1.uid > ballotID2.uid)
    //         return -1
    //     else
    //         return 0
    // }
}

class PaxoNode {
    WINDOW = 5
    constructor(uid, messenger) {
        this.uid = uid
        this.messenger = messenger

        // Replica
        this.slots = [0]*PaxoNode.WINDOW
        this.slot_in = 0
        this.slot_out = 0
        this.requests = []
        this.proposals = []
        this.decisions = []

        // Proposer
        this.nacks = null;
        this.promisesRecieved = null;

        this.nextBallotNum = 1;
        this.ballotID = {num: this.nextBallotNum, uid: this.uid};

        this.decree = null;

        this.isLeader = true;

        this.acquiring = false;
        //TODO: leadership

        // Acceptor
        this.promisedID = null
        this.acceptedID = null
        this.acceptedDecree = null

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
        this.messenger.sendAccept(null, decree)
    }
    //#region Replica
    propose() {
        while ((this.slot_in < this.slot_out + PaxoNode.WINDOW)
                && (this.requests.length != 0))
        {
            // if it's a reconfig, do that
            if (this.slot_in > PaxoNode.WINDOW && this.slot_in - PaxoNode.WINDOW in this.decisions) {
                if (this.decisions[this.slot_in - this.WINDOW].type === 'reconfigure') {
                    var r,a,l =  this.decisions[this.slot_in - PaxoNode.WINDOW].config.split(';')
                    //TODO
                }
            }
            if (!(this.slot_in in this.decisions)) {
                var cmd = this.requests.pop(0)
                this.proposals[this.slot_in] = cmd
                for (leader in this.config.leaders) {
                    this.messenger.sendPropose(leader, this.id, this.slot_in, cmd)
                }
                ++this.slot_in
            }
        }
    }
    perform(c) {
        for (var s = 1; s < this.slot_out; s++) {
            if (this.decisions[s] === c) {
                ++this.slot_out
                return
            }
        }
        if (c.type === 'reconfigure') {
            ++this.slot_out
            return
        }
        ++this.slot_out
    }
    recvRequest(command) {
        this.requests.append(command)
        this.propose()
    }
    recvDecision(command, slot_number) {
        this.decisions[slot_number] = command
        while (this.slot_out in this.decisions) {
            if (this.slot_out in this.proposals) {
                if (this.proposals[this.slot_out] !== this.decisions[this.slot_out]) {
                    this.requests.append(this.proposals[this.slot_out])
                }
                delete this.proposals[this.slot_out]
            }
            this.perform(this.decisions[this.slot_out])
        }
        this.propose()
    }
    //#endregion

    //#region Proposer
    setDecree(decree) {
        // TODO: slots
        if (this.decree === null) {
            this.decree = decree
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
            this.ballotID = this.nextBallotNum //{uid: this.uid, num: this.nextBallotNum};
            ++this.nextBallotNum;
        }

        this.isLeader = true;
        console.log('send prepare', this.ballotID);
        this.messenger.sendPrepare(this.ballotID);
    }
    /**
     * Prepare NACK means that our ballotID wasn't big enough
     * @param {*} fromUID
     * @param {*} ballotID
     * @param {*} promisedID
     */
    recvPrepareNack(fromUID, ballotID, promisedID) {
        console.log('recv prepare NACK', fromUID, ballotID, promisedID)

        // if we didn't send it and it's past our own ballotNum, advance our ballotNum
        if (fromUID !== this.uid) {
            if (compareBallotID(ballotID, this.nextBallotNum) <1) {
                // {num: this.nextBallotNum, uid: this.uid}) < 1) {
                this.nextBallotNum += ballotID.num + 1
            }
        }

        // prepare Nack -> someone else is sending prepares around. Start aqcuiring leadership
        // TODO
        if (this.acquiring)
            this.prepare()
    }
    /**
     * Step 3: send BeginBallot message to all acceptors
     * Phase 2a: when we get an Accept from all in the quorum, send accepted
     * @param {*} fromUID
     * @param {*} ballotID
     * @param {*} prevAcceptedID
     * @param {*} precAcceptedDecree
     */
    recvPromise(fromUID, ballotID, prevAcceptedID, prevAcceptedDecree) {
        console.log('recv promise', fromUID, ballotID, prevAcceptedID, prevAcceptedDecree)

        // if someone else is passing messages around, see if we need to increment our ballotNum
        if (fromUID !== this.uid) {
            // ballotID >= {this.nextBallotNum, this.uid})
            if (compareBallotID(ballotID, this.nextBallotNum) < 1)
                //{num : this.nextBallotNum, uid : this.uid}) < 1)
                this.nextBallotNum += ballotID.num + 1
        }

        // it's for the right ballot and we don't have it in the map yet
        if (compareBallotID(ballotID, this.ballotID) === 0 && !this.promisesRecieved[fromUID]) {
            this.promisesRecieved.add(fromUID);

            if (prevAcceptedID > this.lastAcceptedID) {
                this.lastAcceptedID = prevAcceptedID;

                if (prevAcceptedDecree !== null)
                    this.decree = prevAcceptedDecree
            }

            if (this.promisesRecieved.size === this.quorumSize) {
                if (this.isLeader && this.decree !== null)
                    this.messenger.sendAccept(this.ballotID, this.decree)
            }
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

        if (compareBallotID(ballotID, this.ballotID) === 0)
            this.nacks.add(fromUID)

        if (this.isLeader && this.nacks.size >= this.quorumSize) {
            this.isLeader = false
            this.promisesRecieved = new Set()
            this.leaderUID = null
            this.leaderBallotID = null
            // we aren't the leader, probably
            // TODO
            this.messenger.whoIsLeader()
            this.observeProposal(fromUID, promisedID)
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

        var c = compareBallotID(ballotID, this.promisedID)
        if (c === 0) {
            this.messenger.sendPromise(fromUID, this.acceptedID, this.acceptedDecree)
        }
        else if (c === -1) {
            this.promisedID = ballotID
            this.messenger.sendPromise(fromUID, ballotID, this.acceptedID, this.acceptedDecree)
        }
        else {
            this.messenger.sendPrepareNack(fromUID, ballotID, this.promisedID)
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
            this.messenger.sendAccepted(null, decree)
        }

        // TODO: use c structs here
        // TODO do stuff with slots
        var c = compareBallotID(ballotID, this.promisedID);
        if (c === 0 && decree === this.acceptedDecree) {
            // duplicate
            this.messenger.sendAccepted(ballotID, decree);
        } else if (c < 1) { // ballotID >= promisedID
            this.promisedID = ballotID;
            this.acceptedID = ballotID;
            this.acceptedDecree = decree;
            this.messenger.sendAccepted(ballotID, decree);
        } else {
            this.messenger.sendAcceptNack(fromUID, ballotID, this.promisedID)
        }
    }
    //#endregion
    //#region Learner
    recvAccepted(fromUID, ballotID, acceptedDecree) {
        console.log('recv accepted', fromUID, ballotID, acceptedDecree)

        // If we haven't reached a quorum yet
        if (this.finalDecree !== null) {
            if (acceptedDecree === this.finalDecree) {
                this.finalAcceptors.add(fromUID)
                return
            } else {
                // TODO: do stuff with slots?
            }
        }
        if (this.ballots === null) {
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