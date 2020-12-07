import "utils"

function send_message(to, msg) {
    //TODO
    to.send(msg)
}

function onmessage(msg) {
    for (i = 0; i < message_listeners.length; i++) {
        if (message_listeners[i](msg)) {
            // if message_listeners returns true, then remove it
            message_listeners.splice(i, 1);
            --i;
        }
    }
}

class Replica {
    constructor(env, id, config) {
        this.env = env;
        this.id = id;
        this.config = config;

        this.slot_in = this.slot_out = 1;
        this.proposals = {};
        this.decisions = {};
        this.requests = [];

        // this.env.addProc(this)
    }
    propose() {
        while (this.requests.length != 0 && this.slot_in < this.slot_out + WINDOW) {
            if (this.slot_in > WINDOW & this.slot_in - WINDOW in this.decisions) {
                if (this.decisions[this.slot_in - WINDOW].type === CommandTypes.Reconfigure) {
                    this.config = this.decisions[this.slot_in - WINDOW].config;
                    console.log(this.id, ': new config :', this.config);
                }
            }
            if (!(this.slot_in in self.decisions)) {
                cmd = this.requests.pop()
                this.proposals[this.slot_in] = cmd
                for (leader in self.config.leaders) {
                    send_message(leader, {
                        type: MessageTypes.Propose,
                        slot_number: this.slot_in,
                        command: cmd
                    });
                }
            }
            ++this.slot_in;
        }
    }
    perform(command) {
        for (s = 1; s < this.slot_out; s++) {
            if (this.decisions[s] === cmd) {
                ++this.slot_out;
                return
            }
        }
        if (command.type === CommandTypes.Reconfigure) {
            ++this.slot_out;
            return
        }
        ++this.slot_out;
        console.log(this.id, ": perform", this.slot_out, ":", command)
    }
    onmessage(msg) {
        switch (msg.type) {
            case MessageTypes.Request:
                this.requests.append(msg.command);
                break;
            case MessageTypes.Decision:
                this.decisions[msg.slot_number] = msg.command
                while (this.slot_out in this.decisions) {
                    if (this.slot_out in this.proposals)
                        this.requests.append(this.proposals[this.slot_out])
                    this.proposals.splice(self.slot_out, 1)
                }
                break;
            default:
                console.lot("Learner: unknown message type")
        }
        self.propose()
    }
}

class Acceptor {
    constructor(env, id) {
        this.id = id;
        this.env = env;

        this.ballot_number = null;
        this.accepted = set();

        //this.env.addProc(this)
    }
    onmessage(msg) {
        switch(msg.type) {
            case MessageTypes.P1aMessage:
                if (msg.ballot_number > this.ballot_number)
                    this.ballot_number = msg.ballot_number;
                send_message(msg.src, {
                    type: MessageTypes.P1bMessage,
                    ballot_number: this.ballot_number,
                    accepted: this.accepted
                });
                break;
            case MessageTypes.P2aMessage:
                if (msg.ballot_number === this.ballot_number)
                    this.accepted.add({
                        ballot_number:msg.ballot_number,
                        slot_number: msg.slot_number,
                        command: msg.command
                    });
                send_message(msg.src, {
                    type: MessageTypes.P2bMessage,
                    src: this.id,
                    ballot_number: this.ballot_number,
                    slot_number: msg.slot_number
                });
        }
    }
}

function commander(env, id, leader, acceptors, replicas, ballot_number, slot_number, command) {
    // env.addProc(this)
    waitfor = set();
    for (a in acceptors) {
        send_message(a, {
            type: MessageTypes.P2aMessage,
            src: id,
            ballot_number: ballot_number,
            slot_number: slot_number,
            command: command
        });
        waitfor.add(a);
    }
    function onmessage(msg) {
        switch (msg.type) {
            case MessageTypes.P2bMessage:
                if (ballot_number === msg.ballot_number && msg.src in waitfor) {
                    waitfor.remove(msg.src);
                    if (waitfor.length < acceptors.length / 2) {
                        for (r in replicas) {
                            send_message(r, {
                                type: MessageTypes.Decision,
                                src: id,
                                command: command,
                            });
                        }
                        return true
                    }
                    else {
                        send_message(leader, {
                            type: MessageTypes.Preempt,
                            src: id,
                            ballot_number: msg.ballot_number,
                        });
                        return true
                    }
                }
        }
    }
    // add to the message listeners
    message_listeners.append(onmessage)
}

function scout(env, id, leader, acceptors, ballot_number) {
    // env.addProc(this)
    waitfor = set();
    for (a in acceptors) {
        send_message(a, {
            type: MessageTypes.P1aMessage,
            src: id,
            ballot_number: ballot_number,
        });
        waitfor.add(a);
    }
    pvalues = set();
    function onmessage(msg) {
        switch (msg.type) {
            case MessageTypes.P1bMessage:
                if (this.ballot_number === msg.ballot_number && msg.src in waitfor) {
                    pvalues.update(msg.accepted)
                    waitfor.remove(msg.src)
                    if (waitfor.length < self.acceptors.length / 2) {
                        send_message(leader, {
                            type: MessageTypes.Adpoted,
                            src: id,
                            ballot_number: ballot_number,
                            accepted: pvalues,
                        });
                        return true;
                    }
                    else {
                        send_message(leader, {
                            type: MessageTypes.Preempt,
                            src: id,
                            ballot_number: ballot_number,
                        });
                        return true;
                    }
                }
            default:
                console.log('scout: unexpected msg', msg);
        }
    }
    // add to the message listeners
    message_listeners.append(onmessage)
}

class Leader {
    constructor(env, id, config) {
        this.id = id;
        this.config = config;
        this.env = env

        this.ballot_number = (0, this.id)
        this.active = false
        this.proposals = {}

        // this.env.addProc(this)

        scout(
            env,
            'scout:'+this.id+':'+this.ballot_number+':'+this.slot_number,
            this.id, this.config.acceptors, this.config.replicas
        );
    }
    onmessage(msg) {
        switch(msg.type) {
            case MessageTypes.Propose:
                if (!(msg.slot_number in self.proposals)) {
                    this.proposals[msg.slot_number] = msg.command;
                    if (this.active) {
                        commander(this.env,
                            'commander:'+this.id+':'+this.ballot_number+':'+this.slot_number,
                            this.id, this.config.acceptors, this.config.replicas,
                            this.ballot_number, msg.slot_number, msg.command
                        );
                    }
                }
                break;
            case MessageTypes.Adpoted:
                if (this.ballot_number == msg.ballot_number) {
                    max = {};
                    for (pv in msg.accepted) {
                        bn = max[pv.slot_number];
                        if (bv == null || bn < pv.ballot_number) {
                            max[pv.slot_number] = pv.ballot_number;
                            this.proposals[pv.slot_number] = pv.command;
                        }
                    }
                    for (sn in self.proposals) {
                        commander(this.env,
                            'commander:'+this.id+':'+this.ballot_number+':'+sn,
                            this.id, this.config.acceptors, this.config.replicas,
                            this.ballot_number, sn, this.proposals.get(sn)
                        );
                    }
                    this.active = true;
                }
                break;
            case MessageTypes.Preempt:
                if (msg.ballot_number > this.ballot_number) {
                    this.ballot_number = (msg.ballot_number + 1, this.id)
                    scout(this.env,
                        'scout:'+this.id+':'+this.ballot_number,
                        this.id, this.config.acceptors, this.ballot_number
                    );
                }
                this.active = false;
                break;
            default:
                console.log('leader: unknown message type', msg);
        }
    }
}

class Env {

}

// create the nodes
replica = Replica()
acceptor = Acceptor()
leader = Leader()

message_listeners = [replica.onmessage, acceptor.onmessage, leader.onmessage]