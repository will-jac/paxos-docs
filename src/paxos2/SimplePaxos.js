
var nextBallotNum = 0

// Proposer
// Phase1a
function propose() {
    var ballotNum = nextBallotNum
    ++nextBallotNum
    messenger.sendPrepare(ballotNum)
}

var promisedNum = -1
var acceptedNum = null
var acceptedDecree = null

// Acceptor
function recvPrepare(fromUID, ballotNum) {
    if (ballotNum >= promisedNum) {
        promisedNum = ballotNum
        messenger.sendPromise(fromUID, ballotNum, acceptedNum, acceptedDecree)
    } else {
        messenger.sendPrepareNack(fromUID, ballotNum, promisedNum)
    }

    // heartbeat
    if (fromUID == thi)
}