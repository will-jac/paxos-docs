
WINDOW = 5

MessageTypes = {
    Propose: 0,
    Adopted: 1,
    Preempt: 2,
    Nack: 3,
    // -> learner
    Request: 4,
    Decision: 5,
    // -> acceptor
    P1aMessage: 6,
    P1bMessage: 7,
    P2aMessage: 8,
    P2bMessage: 9,
    // -> leader
    Adopted: 10,
}

Message = {
    type: MessageTypes.Propose,
    slot_number: null,
    command: null,
    // P1a
    ballot_number: null,
    src: null,
    // P1b
    accepted: false,
}

CommandTypes = {
    Reconfigure = 0
}

Command = {
    type: CommandTypes.Reconfigure,
    client: null,
    request_id: null,
    op: null
}

ReconfigCommand = {
    client: null,
    request_id: null,
    config: null
}

Config = {
    replicas: [],
    acceptors: [],
    leaders: []
}