import React from 'react';
import './Toolbar.css';

function format(com, val) {
  document.execCommand(com, false, val);
}

function connect(e) {
  e.preventDefault();
  const connect_id = document.getElementById('connectID').value;
  // contact the server and get a websocket connection if this is valid
  console.log(connect_id);
}

function handleSubmit() {}

function Toolbar(props) {
  return (
  <div className='toolbar'>
    <div id='connectInput'>
      <input id='connectID' placeholder='Connect ID'/>
      <button onClick={e => connect(e)}>Load</button>
    </div>
    <button onClick={e => format('bold')}>Bold</button>
    <button onClick={e => format('italic')}>Italics</button>
    <button onClick={e => handleSubmit()}>Submit</button>
  </div>
  )
}

export default Toolbar