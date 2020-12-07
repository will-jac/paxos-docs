
const nullElement = -1;
const quorumSize;
// propser
var propCmd = [null]

// -----------leader-----------
// largest balnum m assigned such that maxTried[m] != none
var maxStarted = null
// maxTried[maxStarted] -> c-struct
var maxVal = null
// computes ProvedSafe(Q,m,bA)

// ---------acceptor-----------
// bA_a (active ballot)
var mBal = null
// Max{k in balnum | bA_a[k] != none}
var bal = null
// bA_a[bal[a]] -> c-struct (?)
var val = null

var maxTried = [null]

// learner
var learned = [null]

/**
 * Executed by proposer of command.
 * Always enabled.
 * Sets propCmd.
 * Sends <propose, command>
 * @param {*} command
 */
function sendProposal(command) {
    if (!(command in propCmd)) {
        // propCmd = propCmd U {C}
        propCmd.push(command)
    }
    messenger.sendProposal(command)
}
/**
 * Executed by leader of ballot number m.
 * Enabled iff maxTried[m] = none.
 * Sends <1a, m> to acceptors.
 * @param {*} m
 */
function Phase1A(m) {
    if (maxTried[m] === null) {
        messenger.send1A(m)
    }
}
/**
 * Executed by acceptor A for balnum M.
 * Enabled iff a has recieve <1a,m> from the leader
 * and activeBallot < m.
 *
 * Sends the message <1b, m, a, bA_a> to the leader
 * and sets activeBallot = m.
 *
 * Implements JoinBallot(a,m).
 * @param {*} a
 * @param {*} m
 */
function Phase1B(a, m) {
    if (m < mBal) { // ?? shouldn't this be the opposite ??
        mBal = m
        // send to leader
        messenger.send1b(m, a, bal, val)
    }
}
/**
 * Executed by the leader of ballot m, for c-struct v.
 *
 * Enabled when:
 *  maxTried[m] = null,
 *  leader has recieved a 1b message for m from every acceptor in an m-quorum Q,
 *  v = w + s, where s in Seq(propCmd), w in ProvedSafe(Q, m, B), and B is any ballot array
 *  such that, for every acceptor a in Q, activeBallot = k and the leader has received a message
 *  <1b, m, a, p> with activeBallot = p.
 *
 * Sets minTried[m] and maxTried[m] to v + s and sends the message <2a, m, v+s> to acceptors,
 * where s is some sequence of commands, each element of which the leader has recieved in 'propse'
 * messages
 *
 * Implements StartBallot(m, Q)
 *
 * @param {Ballot} m
 * @param {c-struct} v
 */
function Phase2Start(m, v) {
    if (m > maxStarted) { // maxTried[m] = none
        if (m.quorum.size() > quorumSize) {
            if ()
        }
    }

}