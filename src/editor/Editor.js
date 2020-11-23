import React from 'react';
import ReactQuill from 'react-quill';
import PaxosNode from './../paxos2/MultiPaxos';

import 'react-quill/dist/quill.snow.css';
import 'react-quill/dist/quill.bubble.css';

import './../App.css';
import './Editor.css';


class Editor extends React.Component {

  constructor(props) {
    super()

    const pn = new PaxosNode()

    this.editorRef = React.createRef();

    this.applyChange = this.applyChange.bind(this);
    this.onchange = this.onchange.bind(this);

    props.peer.bindPaxosNode(pn, this.applyChange, this);

    this.state = {
      docname: props.docname,
      value: null,
      pn: pn
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
    this.state.pn.propose(this.editorRef.getEditor().getContents());
  }

  render() {
    return (
      <div className='App'>
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