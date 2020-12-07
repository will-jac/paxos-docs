
class PaxosNode {

    constructor() {
        // Replica
        this.slot_in = 0
        this.slot_out = 0

        this.proposals = new Set();

        this.quorumSize = 1

        this.window = 5

        // Proposer
        this.nacks = null;
        this.promisesRecieved = null;

        this.nextBallotNum = 1;
        this.ballotID = {num: this.nextBallotNum, uid: this.uid};

        this.decree = null;

        this.requests = [];
        this.decisions = new Set();

        this.acquiring = false;
        // this leader set up makes it so that any change to the quorum triggers a leader change
        this.isLeader = true;
        this.leaderUID = null;

        this.period = 2
        //TODO: leadership

        // Leader
        this.acceptedSet = new Set();
        this.leaderProposals = new Set()

        // Acceptor
        this.promisedID = {num: null, uid: null}
        this.acceptedID = null
        this.acceptedDecree = null
        this.accepted = []

        // Learner
        this.ballots = null
    }
    send () {
        console.log('send', arguments)
    }
    setQuorumSize(size, joined, uidJoinedOrDied) {
        console.log('quorum size is:', size)
        this.quorumSize = size
        if (uidJoinedOrDied === this.leaderUID || (size === 1 && !this.isLeader))
        {
            console.log('acquiring leadership')
            this.isLeader = true
            this.leaderUID = this.uid
            this.acquireLeadership()
        } else if (joined) {
            console.log('new user, died ID is:', uidJoinedOrDied)
            this.updateNewUser()
        }
    }
    updateNewUser() {
        console.log('updating new user')
        if (this.isLeader) {
            this.request({
                type: 'init',
                leaderUID: this.leaderUID,
                decisions: JSON.stringify(this.decisions)
            })
        }
    }
//#region Paxos made moderately complex
//#region Replica
    propose() {
        console.log('propose',  this.slot_in, this.slot_out, this.window, this.requests.length, this.requests)
        // iterate through the requests

        // console.log('requests', this.requests.length, r, this.requests)
        // console.log('slots:', this.slot_in, this.slot_out)

        while (this.requests.length !== 0 && (this.slot_in < this.slot_out + this.window)) {
            // console.log('working on',  this.slot_in)
            // if (this.slot_in > PaxosNode.window && this.slot_in - PaxosNode.window in this.decisions) {
            //     // TODO: decisions
            //     // TODO: reconfigure command
            // }
            // if we haven't already decided one
            if (!this.decisions[this.slot_in]) {
                var decree = this.requests.shift()
                // console.log('requests', this.requests.length, r, this.requests)
                // console.log('setting proposal', this.decisions[this.slot_in], this.slot_in, decree)
                this.proposals[this.slot_in] = decree
                this.send('propose', this.leaderUID, this.slot_in, decree)
            }
            ++this.slot_in
        }
    }
    // this is the entry point
    request(decree) {
        console.log('request', decree)
        this.requests.push(decree)
        this.propose()
    }
    onDecision(slot_num, decree) {
        console.log('onDecision', slot_num, decree)
        this.decisions[slot_num] = decree
        while (this.decisions[this.slot_out]) {
            if (this.proposals[this.slot_out]) {
                // console.log(this.proposals[this.slot_out])
                // console.log(this.decisions[this.slot_out])
                if (JSON.stringify(this.proposals[this.slot_out]) !== JSON.stringify(this.decisions[this.slot_out])) {
                    // console.log('oh no! proposal != decision')
                    // console.log(this.proposals[this.slot_out])
                    // console.log(this.decisions[this.slot_out])
                    // we have a decision for this slot, but it's not the proposal for the slot!
                    // move the proposal to the requests
                    // console.log('appending requests', this.proposals[this.slot_out])
                    this.requests.push(this.proposals[this.slot_out])
                }
                delete this.proposals[this.slot_out]
                // this.proposals.splice(this.slot_out, 1)
            }
            ++this.slot_out
        }
        this.propose()
    }
    recvAccepted(fromUID, ballotID, slotNum, decree) {
        console.log('recv accepted', fromUID, ballotID, slotNum, decree)

        // If we haven't reached a quorum yet
        if (this.finalDecree !== null) {
            if (decree === this.finalDecree) {
                // this.finalAcceptors.add(fromUID)
                return
            }
        }
        if (this.ballots === null) {
            this.ballots = {}
            this.acceptors = {}
        }
        var lastSlotNum = this.acceptors[fromUID]
        // is it an old message?
        if (lastSlotNum >= slotNum ) {
            console.log('old ballot', this.acceptors[fromUID])
            return
        }
        this.acceptors[fromUID] = slotNum
        if (lastSlotNum) {
            // delete the old ballot
            var oldBallot = this.ballots[lastSlotNum]
            delete oldBallot[1][fromUID]
            if (oldBallot[1].size === 0) {
                delete this.ballots[lastSlotNum]
            }
        }

        // if it's not in the dictionary
        if (!this.ballots[slotNum]) {
            console.log('!this.ballots[slotNum]')
            // acceptors, retainers, decree
            this.ballots[slotNum] = [new Set(), new Set(), decree]
        }

        var t = this.ballots[slotNum]

        if (JSON.stringify(decree) !== JSON.stringify(t[2])) {
            console.log('decree mismatch for ballot... uh oh!!', decree, t[2])
            return
        }

        t[0].add(fromUID)
        t[1].add(fromUID)

        if (t[0].size === this.quorumSize) {
            console.log('reached quorum', this.quorumSize, decree)
            this.finalDecree = decree
            this.finalBallotID = ballotID
            this.finalSlotNum = slotNum
            // this.finalAcceptors = t[0]
            this.ballots = null
            this.acceptors = null

            if (decree) {
                if (decree.type === 'leader') {
                    console.log('leader message:', decree.leaderUID)
                    this.leaderUID = decree.leaderUID
                    console.log('leader is:', this.leaderUID)

                    this.isLeader = (this.leaderUID === this.uid)
                    this.acquiring = false

                    if (this.isLeader) {
                        this.pulse();
                    }
                }
                else if (decree.type === 'init') {
                    console.log('init: leader:', decree.leaderUID)
                    this.leaderUID = decree.leaderUID

                    this.isLeader = (this.leaderUID === this.uid)
                    this.acquiring = false

                    this.decisions = JSON.parse(decree.decisions)
                    // find the most recent decision that isn't an init
                    var k_i = Object.keys(this.decisions).reverse()
                    for (var i in k_i) {
                        if (this.decisions[k_i[i]].type !== 'leader' && this.decisions[k_i[i]].type !== 'init') {
                            // it's a state message
                            console.log('init: resolving')
                            this.onResolution(this.decisions[k_i[i]])
                            break
                        }
                    }
                }
                else {
                    this.onResolution(decree)
                }
                // console.log('calling onDecision for', decree)
                this.onDecision(slotNum, decree)
            }
        }
    }
//#endregion
//#region scout
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
            this.acceptedSet = new Set();
            this.ballotID.num = this.nextBallotNum
            ++this.nextBallotNum;
        }

        this.isLeader = true;
        //console.log('send prepare', this.ballotID);
        this.send('prepare', this.ballotID);
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
    recvPromise(fromUID, ballotID, accepted) {
        console.log('recv promise', fromUID, ballotID, accepted)

        // if someone else is passing messages around, see if we need to increment our ballotNum
        if (fromUID !== this.uid && ballotID.num >= this.nextBallotNum) {
            this.nextBallotNum += ballotID.num + 1
        }

        // it's for the right ballot and we don't have it in the map yet
        if (ballotID.uid === this.ballotID.uid && ballotID.num === this.ballotID.num) {
            if (!this.promisesRecieved[fromUID]) {
                console.log('adding promise:', fromUID)
                this.acceptedSet.add(accepted)

                // if (prevAcceptedID > this.lastAcceptedID) {
                //     this.lastAcceptedID = prevAcceptedID;

                //     if (prevAcceptedDecree !== null)
                //         this.decree = prevAcceptedDecree
                // }
                console.log('size:', Object.keys(this.promisesRecieved).length, this.isLeader)
                if (Object.keys(this.promisesRecieved).length >= this.quorumSize && this.isLeader) {
                    console.log('quorum of promises recv')
                    // TODO
                    this.leaderOnAdopted(this.ballotID, this.acceptedSet)
                }
            }
        } else {
            // wrong uid.. try to become leader again
            console.log('wrong ballotID...', ballotID)
            this.acquireLeadership()
        }
    }
//#endregion
//#region Leader
    // called when P1 is complete
    leaderOnAdopted(ballotID, accepted) {
        console.log('adopted', ballotID, accepted)
        if (this.ballotID.uid === ballotID.uid && this.ballotID.num === ballotID.num) {
            var pmax = {}
            for (var pv in accepted) {
                if (!(pv.slot_num in pmax) || (pmax[pv.slot_num].num < pv.ballotID.num)) {
                    pmax[pv.slot_num] = pv.ballotID
                    this.leaderProposals[pv.slot_num] = pv.decree
                }
            }
            for (var slot_num in this.leaderProposals) {
                // js is weird...
                this.send('accept', this.ballotID, slot_num, this.leaderProposals[slot_num])
            }
            this.isLeader = true
        }
    }
    // Initiates P2 (leader's entry for fast paxos)
    recvPropose(fromUID, slot_num, decree) {
        console.log('recv propose', slot_num, decree, this.leaderProposals, this.leaderProposals[slot_num])
        if (!this.leaderProposals[slot_num]) {
            console.log('new proposal for slot_num')
            this.leaderProposals[slot_num] = decree
            // if the size is 1, acquire leadership
            if (this.quorumSize === 1) {
                this.isLeader = true
            }
            if (this.isLeader) {
                // TODO: spawn commander
                this.send('accept', this.ballotID, slot_num, decree)
            }
        }
        else {
            console.log(this.leaderProposals[slot_num])
        }
        // else {
        //     this.send('proposeNack', fromUID, this.)
        // }
    }
    // called when P2 is preempted
    recvPreempt(ballotID) {
        console.log('recv Preempt')
        this.isLeader = false
        if (ballotID.num >= this.ballotID.num) {
            console.log('preparing')
            this.ballotID.num = ballotID + 1
            this.acquireLeadership()

            // scout
            // this.prepare()
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

        if (ballotID.num > this.promisedID.num ||
                (ballotID.num === this.promisedID.num && ballotID.uid > this.promisedID.num))
        {
            // update our own ballotID in case we need to be the leader later
            this.nextBallotNum = ballotID.num + 1
            this.promisedID = ballotID
        }
        this.send('promise', fromUID, this.promisedID, this.accepted)
        // else {
        //     this.send('prepareNack',fromUID, ballotID, this.promisedID)
        // }
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
    recvAccept(fromUID, ballotID, slot_num, decree) {
        console.log('recv accept', fromUID, ballotID, slot_num, decree);

        if (fromUID !== this.uid && ballotID.num <= this.nextBallotNum) {
            this.nextBallotNum = ballotID.num + 1
        }

        // TODO: use c structs here
        if (ballotID.num === this.promisedID.num && ballotID.uid === this.promisedID.uid && decree === this.acceptedDecree) {
            // duplicate
            this.send('accepted', ballotID, slot_num, decree);
        } else if (ballotID.num >= this.promisedID.num) { // ballotID >= promisedID
            this.promisedID = ballotID;
            this.acceptedID = ballotID;
            this.acceptedDecree = decree;
            this.accepted.push({ballotID:ballotID, slot_num:slot_num, decree:decree})
            this.send('accepted', ballotID, slot_num, decree);
        } else {
            this.send('preempt', this.leaderUID, this.promisedID)
        }
    }
    // recvAcceptNack(fromUID, ballotID, promisedID) {
    //     // accept nack: someone else is leader, or we need to do a prepare again (because someone else was leader)
    //     if (this.ballotID.num <= promisedID.num) {
    //         this.ballotID.num += promisedID.num + 1
    //     }
    //     // move from proposals -> requests
    //     for ()
    //     this.requests.push
    //     this.acquireLeadership()

    // }
//#endregion

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
                //this.messenger.onLeadershipLost()
                //this.observeProposal(fromUID, ballotID)
                this.nextBallotNum = ballotID.num + 1
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

        // push this to the start -> first thing we want to do
        this.requests.unshift({
            type: 'leader',
            leaderUID: this.uid
        })
        this.prepare()
    }
    //#endregion
}

export default PaxosNode