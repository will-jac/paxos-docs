import React, {useState} from 'react';
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link
} from 'react-router-dom';
import Editor from './editor/Editor';


export default function App(props) {
  const [docId, setDocID] = useState('foo')
  // const [peer] = useState(new PeerMessenger())
  return (
    <Router>
      <Switch>
        <Route path="/document">
          <Editor docname={docId} peer={props.peer}/>
        </Route>
        <Route path="/">
          <div className='App'>
            <p>Document ID</p>
            <p>
              <input type="text" value={docId} onChange={(e) => setDocID(e.target.value)}/>
            </p>
            <p>
              <Link to="/document">
                <button>Load Document</button>
              </Link>
            </p>
          </div>
        </Route>
      </Switch>
    </Router>
  )
}
