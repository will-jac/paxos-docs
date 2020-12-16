
const PeerMessenger = require('./PaxosMessenger')
const PaxosNode = require('./Paxos');

const peer = new PeerMessenger()
const pn = new PaxosNode()

function printChange(p, c) {
    console.println(p, 'applying', c)
}
function isLeader(p, leader) {
    if (leader)
        console.println(p, 'is leader')
    else
        console.println(p, 'is no longer leader')
}

peer.bindPaxosNode(pn, (c) => printChange('1', c), this);
pn.onLeaderChange = (l) => isLeader('1', l)

// now, one priest will be connected
pn.request('hello!')


const peer2 = new PeerMessenger()
const pn2 = new PaxosNode()

peer.bindPaxosNode(pn2, (c) => printChange('2', c), this);
pn2.onLeaderChange = (l) => isLeader('2', l)

// now, two priests will be connected
pn.request('hello number 2!')
pn2.request('hello from 2')

pn.request('a')
pn.request('b')
pn.request('c')

pn2.request('a')
pn2.request('b')
pn2.request('c')

delete pn
delete peer

pn2.request('1')
pn2.request('2')
pn2.request('2')

// run in multiple terminals for more priests


