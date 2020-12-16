
import Peer from 'peerjs';
import { v4 as uuidv4 } from 'uuid';

const io = require('socket.io-client')

const ioHost = 'localhost:3030';
const peerHost = {
    host: 'localhost',
    port: 3030,
    path: '/peerjs/peer'
};

export default class PeerMessenger {
    constructor() {
        this.uid = uuidv4();
        console.log('messenger created:', this.uid);

        this._peers = {};

        this.socket = io(ioHost);
        this.socket.on('connect', () => {
            this.socket.on('user_connected', (uid) => {
                if (uid === this.uid) {
                    return;
                }
                this._connectTo(uid);
                console.log('user connected', uid);
            });
            this.socket.on('user_disconnected', (uid) => {
                if (uid === this.uid) {
                    return
                }
                this._disconnectFrom(uid);
                console.log('user disconnected', uid);
            });
        });

        this.peer = new Peer(this.uid, peerHost);

        this.peer.on('connection', (conn) => {
            console.log('connection from', conn.peer)
            conn.on('open', () => {
                this._registerPeer(conn.peer, conn, false);
                // this.updateNewUser(conn.peer);
            })
        });

        this.callback = () => {
            console.log(arguments)
        }
    }

    bindPaxosNode(pn, callback, context) {

        pn.uid = this.uid
        pn.ballotID.uid = this.uid
        pn.leaderUID = this.uid

        pn.onResolution = callback.bind(context)
        pn.send = this.send.bind(this)

        pn.quorumSize = this.quorumSize
        this.setQuorumSize = pn.setQuorumSize.bind(pn)

        this.recvPropose = pn.recvPropose.bind(pn)
        this.recvPrepare = pn.recvPrepare.bind(pn)
        this.recvPromise = pn.recvPromise.bind(pn)
        this.recvAccept = pn.recvAccept.bind(pn)
        this.recvAccepted = pn.recvAccepted.bind(pn)
        this.recvPreempt = pn.recvPreempt.bind(pn)

        this.onDecision = pn.onDecision.bind(pn)

    }

    setQuorumSize(size) {
        this.quorumSize = size
        console.log('quorum size (in peer messenger):', size)
    }

    _connectTo(uid) {
        console.log('connect to:', uid);
        var conn = this.peer.connect(uid);
        conn.on('open', () => {
            this._registerPeer(uid, conn, true);
        });
    }

    _registerPeer(uid, conn, isConnectingTo) {
        this._peers[uid] = conn;
        conn.on('data', (msg) => {
            this.recvmsg(uid, msg);
        });
        var n = Object.keys(this._peers).length + 1
        this.setQuorumSize(Math.ceil(n / 2) + 1, n, isConnectingTo, uid);
    }

    _disconnectFrom(uid) {
        delete this._peers[uid];
        var n = Object.keys(this._peers).length + 1
        this.setQuorumSize(Math.ceil(n / 2) + 1, n, false, uid);
    }

    broadcast(msg) {
        // console.log(msg)
        for (var peer in this._peers) {
            this._send(peer, msg);
        }
        // send to self
        this.recvmsg(this.uid, msg);
    }

    _send(uid, msg) {
        if (uid === this.uid) {
            // send to self!
            this.recvmsg(this.uid, msg);
            return
        }
        // network dropper!
        // if (Math.random() < 0.25) {
        //     return
        // }
        if (this._peers[uid] && this._peers[uid].open) {
            // console.log(peer, this._peers[peer])
            this._peers[uid].send(msg);
        }
    }

    send() {
        if (arguments[0] !== 'heartbeat')
            console.log('send', Array.from(arguments))
        switch (arguments[0]) {
            case 'prepare':     // broadcast by proposer to acceptors
            case 'accept':      // broadcast by proposer to acceptors
            case 'accepted':    // broadcast by acceptor to learner
            case 'heartbeat':   // bcast by proposer -> proposers
                this.broadcast(JSON.stringify(Array.from(arguments)));
                break;
            case 'propose':     // replica -> leader
            case 'preempt':     // acceptor -> leader
            case 'promise':     // sent from acceptor to proposer
            case 'prepareNack': // Acceptor -> proposer when prepare is bad
            case 'acceptNack':  // Acceptor -> proposer when Accept is bad
            case 'decided':    // when a propose comes for a slot that's already been decided
            case 'init':
                //console.log(arguments[1])
                this._send(arguments[1], JSON.stringify(Array.from(arguments)));
                break;
            case 'resolution':  // broadcast by learner (=> client?)
                this.callback(Array.from(arguments));
                break;
            default:
                console.log('error finding match', arguments[0])
        }
    }

    recvmsg(uid, msg) {
        msg = JSON.parse(msg)
        // console.log('recv', uid, msg);

        switch(msg[0]) {
            case 'propose':     // replica -> leader
                this.recvPropose(uid, msg[2], msg[3]);
                break;
            case 'preempt':     // acceptor -> leader
                this.recvPreempt(msg[1], msg[2]);
                break;
            case 'prepare':     // broadcast by proposer to acceptors
                this.recvPrepare(uid, msg[1]);
                break;
            case 'accept':      // broadcast by proposer to acceptors
                this.recvAccept(uid, msg[1], msg[2], msg[3]);
                break;
            case 'accepted':    // broadcast by acceptor to learner
                this.recvAccepted(uid, msg[1], msg[2], msg[3]);
                break;
            case 'heartbeat':   // bcast by proposer -> proposers
                this.recvHeartbeat(uid, msg[1]);
                break;
            case 'promise':     // sent from acceptor to proposer
                this.recvPromise(uid, msg[2], msg[3]);
                break;
            case 'prepareNack': // Acceptor -> proposer when prepare is bad
                this.recvPrepareNack(uid, msg[2], msg[3]);
                break;
            // case 'acceptNack':  // Acceptor -> proposer when Accept is bad
            //     this.recvAcceptNack(uid, msg[2], msg[3])
            //     break;
            case 'init':
                this.recvInit(uid, msg[2], msg[3])
                break;
            case 'decided':
                this.onDecision(msg[2], msg[3])
                break;
            default:
                console.log('error finding match', msg)
        }
    }
    // Nothing happens as a result of these messages (used for testing)

    // bcast by proposer -> proposers
    // onLeadershipAcquired() {
    //     console.log('leadershipAcquired')
    //     this.conn.emit('leadershipAcquired')
    // }
    // // bcast by proposer -> proposers
    // onLeadershipLost() {
    //     console.log('leadershipLost')
    //     this.conn.emit('leadershipLost')
    // }
    // // bcast by proposer -> proposers
    // onLeadershipChange(prevLeaderUID, newLeaderUID) {
    //     console.log('leadershipChange', prevLeaderUID, newLeaderUID)
    //     this.conn.emit('leadershipChange', prevLeaderUID, newLeaderUID)
    // }
    recvPrepare = () => {console.log('recv prepare in peer messenger')}
    recvPromise = () => {console.log('recv promise in peer messenger')}
    recvAccept = () => {console.log('recv accept in peer messenger')}
    recvAccepted = () => {console.log('recv accepted in peer messenger')}
    recvPrepareNack = () => {console.log('recv prepare nack in peer messenger')}
    recvAcceptNack = () => {console.log('recv prepare nack in peer messenger')}
    recvHeartbeat = () => {console.log('recv heartbeat in peer messenger')}
}