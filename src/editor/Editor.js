import React from 'react';
import ReactQuill from 'react-quill';
import PaxosNode from './../paxos2/PaxosMMC';

import { RiVipCrownLine, RiVipCrownFill } from 'react-icons/ri';

import 'react-quill/dist/quill.snow.css';
import 'react-quill/dist/quill.bubble.css';

import './../App.css';
import './Editor.css';


class Editor extends React.Component {

  constructor(props) {
    super()

    const pn = new PaxosNode()

    pn.onLeaderChange = this.onLeaderChange.bind(this);
    pn.setNumConnected = this.setNumConnected.bind(this);

    this.editorRef = React.createRef();

    this.applyChange = this.applyChange.bind(this);
    this.onchange = this.onchange.bind(this);

    props.peer.bindPaxosNode(pn, this.applyChange, this);

    this.state = {
      docname: props.docname,
      value: null,
      pn: pn,
      isLeader: true,
      numConnected: 1
    }
  }

  applyChange(delta) {
    console.log('applying change: ', delta)
    this.setState({
      value: delta
    });
  }

  onchange(delta) {
    console.log(delta, this.editorRef.getEditor().getContents());
    //socket.emit('peer-msg', delta);
    this.state.pn.request(this.editorRef.getEditor().getContents());
  }

  onLeaderChange(isLeader) {
    this.setState({
      isLeader: isLeader
    })
  }

  setNumConnected(n) {
    this.setState({
      numConnected: n
    })
  }

  render() {
    return (
      <div className='App'>
        <p className='header'>
          {this.state.numConnected} Priest{this.state.numConnected > 1 ? 's' : null} Connected { }
          {this.state.isLeader ? <RiVipCrownFill/> : <RiVipCrownLine/>}
        </p>
        <ReactQuill
          value={this.state.value}
          onChange={(c, d, s, e) => this.onchange(d)}
          ref={(el) => { this.editorRef = el }}
        />
      </div>
    );
  }
}

export default Editor