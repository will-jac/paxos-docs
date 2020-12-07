class Messenger {
    constructor(socket, callback) {
        console.log('messenger created');
        this.socket = socket;
        this.callback = callback

        this.sendPrepare = this.sendPrepare.bind(this)
        this.sendPromise = this.sendPromise.bind(this)
        this.sendAccept = this.sendAccept.bind(this)
        this.sendAccepted = this.sendAccepted.bind(this)
        this.sendPrepareNack = this.sendPrepareNack.bind(this)
        this.sendAcceptNack = this.sendAcceptNack.bind(this)
        this.sendHeartbeat = this.sendHeartbeat.bind(this)
        this.onResolution = this.onResolution.bind(this)
        this.onLeadershipAcquired = this.onLeadershipAcquired.bind(this)
        this.onLeadershipLost = this.onLeadershipLost.bind(this)
        this.onLeadershipChange = this.onLeadershipChange.bind(this)
    }
    // broadcast by proposer to acceptors
    sendPrepare (ballotID) {
        console.log('sendPrepare', ballotID);
        this.socket.emit('prepare', ballotID);
    }
    // sent from acceptor to proposer
    sendPromise(proposerUID, ballotID, prevID, prevDecree) {
        console.log('promise', proposerUID, ballotID, prevID, prevDecree);
        this.socket.emit('promise', proposerUID, ballotID, prevID, prevDecree);
    }
    // broadcast by proposer to acceptors
    sendAccept(ballotID, decree) {
        console.log('SENDING ACCEPT', ballotID, decree);
        this.socket.emit('accept', ballotID, decree);
    }
    // broadcast by acceptor to learner
    sendAccepted(ballotID, decree) {
        console.log('accepted', ballotID, decree);
        this.socket.emit('accepted', ballotID, decree);
    }
    // Acceptor -> proposer when prepare is bad
    sendPrepareNack(toUID, ballotID, promisedID) {
        console.log('prepareNack', toUID, ballotID, promisedID);
        this.socket.emit('prepareNack', toUID, ballotID, promisedID);
    }
    // Acceptor -> proposer when Accept is bad
    sendAcceptNack(toUID, ballotID, promisedID) {
        console.log('acceptNack', toUID, ballotID, promisedID);
        this.socket.emit('acceptNack', toUID, ballotID, promisedID);
    }
    // bcast by proposer -> proposers
    sendHeartbeat() {
        console.log('heartbeat')
        this.socket.emit('heartbeat')
    }
    // broadcast by learner (=> client?)
    onResolution(ballotID, decree) {
        console.log('resolution', ballotID, decree)
        this.socket.emit('resolution', ballotID, decree)

        this.callback(decree)
    }
    // Nothing happens as a result of these messages (used for testing)

    // bcast by proposer -> proposers
    onLeadershipAcquired() {
        console.log('leadershipAcquired')
        this.socket.emit('leadershipAcquired')
    }
    // bcast by proposer -> proposers
    onLeadershipLost() {
        console.log('leadershipLost')
        this.socket.emit('leadershipLost')
    }
    // bcast by proposer -> proposers
    onLeadershipChange(prevLeaderUID, newLeaderUID) {
        console.log('leadershipChange', prevLeaderUID, newLeaderUID)
        this.socket.emit('leadershipChange', prevLeaderUID, newLeaderUID)
    }
}

export default Messenger;