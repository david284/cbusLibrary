<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>JSDoc: Home</title>

    <script src="scripts/prettify/prettify.js"> </script>
    <script src="scripts/prettify/lang-css.js"> </script>
    <!--[if lt IE 9]>
      <script src="//html5shiv.googlecode.com/svn/trunk/html5.js"></script>
    <![endif]-->
    <link type="text/css" rel="stylesheet" href="styles/prettify-tomorrow.css">
    <link type="text/css" rel="stylesheet" href="styles/jsdoc-default.css">
</head>

<body>

<div id="main">

    <h1 class="page-title">Home</h1>

    



    


    <h3> </h3>










    




    <section>
        <article><h1>cbusLibrary</h1>
<p>Library for decoding and encoding CBUS Layout Control Bus (LCB) messages.
There is a very comprehensive set of tests for this - see ## tests section further below.
The decoding and encoding follows the CBUS specification available here
<a href="https://www.merg.org.uk/merg_wiki/doku.php?id=public:cbuspublic:developerguide">CBUS dev guide</a></p>
<p><a href="cbusLibrary.html">cbusLibrary API</a></p>
<h2>Installation</h2>
<pre><code>npm install cbuslibrary
</code></pre>
<p>(note all lower case - npm no longer allows uppercase)</p>
<h2>usage</h2>
<pre><code>const cbusLib = require('cbusLibrary')
</code></pre>
<p>An instance of the class is created automatically, so can be used immediately</p>
<p>for decoding, there's one common function (as the opcode is embedded in the message)
var cbusMsg = cbusLib.decode(<message to be decoded>)</p>
<p>for encoding, each opCode has it's own function, as the type &amp; number of parameters vary with opCode
var encode = cbusLib.encodeEVLRN(nodeNumber, eventNumber, VariableIndex, eventVariableValue);</p>
<p>The decode function returns a collection of values, with &quot;encoded&quot;, &quot;mnemonic&quot;, &quot;opCode&quot; and &quot;text&quot; being standard for all opCodes
See an expanded description of 'eventName' further below</p>
<p>example decode:</p>
<pre><code>{
  &quot;encoded&quot;: &quot;:SB780ND200010000FF00;&quot;,
  &quot;mnemonic&quot;: &quot;EVLRN&quot;,
  &quot;opCode&quot;: &quot;D2&quot;,
  &quot;nodeNumber&quot;: 1,
  &quot;eventNumber&quot;: 0,
  &quot;eventName&quot;: &quot;00010000&quot;,
  &quot;eventVariableIndex&quot;: 255,
  &quot;eventVariableValue&quot;: 0,
  &quot;text&quot;: &quot;EVLRN (D2) nodeNumber 1 eventNumber 0 eventName 00010000 Event Variable Index 255 Event Variable Value 0&quot;
}
</code></pre>
<p>Note that some properties have full names to avoid confusion (e.g. eventVariableIndex, rather than EV#)</p>
<p>Look at the test file to see examples of usage for all opCodes
mergAdminNode.spec.js</p>
<h2>eventName</h2>
<p>Typically, in a message the node number represents the sending module of the message
For 'learning' opCodes, the node/event number combination can represent the event identity stored (or to be stored) in the event table
'eventName' is a property (in addition to nodeNumber &amp; eventNumber) that holds the node/event number combination in hexadecimal format
This can be easier to use in code to uniquely identify an entry in the stored event table (as opposed to an actual message on the CAN bus)
Note that the encode function still requires the individual node &amp; event numbers, this only applies to decodes of specific opCodes</p>
<p>First implemented for the following opCodes
95 EVULN - remove event
B2 REQEV - read event variable in learn mode
D2 EVLRN - teach event
D3 EVANS - response to REQEV
F2 ENRSP - uses 4 byte eventName as well as nodeNumber
F5 EVLRNI - teach event with index</p>
<h2>CAN header</h2>
<p>There are default values for the CAN header used when encoding messages, but these can be changed using the following function</p>
<pre><code>setCanHeader(MjPri, CAN_ID)
</code></pre>
<p>Once set, the new values will continue to be used for subsequent encodes (or until the program is restarted)</p>
<p>Note that MinPri is specifically defined for each opCode, so is set for each individual opCode and not expected to be changed</p>
<h2>tests</h2>
<p>There is a comprehensive suite of unit tests for all the opCodes</p>
<p>Run all tests
npm test
Will run al the tests - note there are more than 18,000 tests, and although doesn't take too long, it does create a huge log file</p>
<p>You can also run tests for a specific opCode, which produces a much more workable log file
npm test -- --grep &quot;EVLRN&quot;</p>
<p>The log file is created in /tests/logs, and is overwritten on each test run</p></article>
    </section>









<section>

<header>
    
        <h2>cbuslibrary.js</h2>
        
    
</header>

<article>
    <div class="container-overview">
    
        
            <div class="description"><strong>Module to decode & encode CBUS message strings</strong></br>The decode method expects the CBUS message string to be in the 'Grid connect' CAN over serial message syntax</br>And the encode methods returns a message string in the same format</br></div>
        

        


<dl class="details">

    

    

    

    

    

    

    

    

    

    

    

    

    
    <dt class="tag-source">Source:</dt>
    <dd class="tag-source"><ul class="dummy"><li>
        <a href="cbuslibrary.js.html">cbuslibrary.js</a>, <a href="cbuslibrary.js.html#line22">line 22</a>
    </li></ul></dd>
    

    

    

    
</dl>


        
    
    </div>

    

    

    

    

    

    

    

    

    

    
</article>

</section>




</div>

<nav>
    <h2><a href="index.html">Home</a></h2><h3>Classes</h3><ul><li><a href="cbusLibrary.html">cbusLibrary</a></li></ul>
</nav>

<br class="clear">

<footer>
    Documentation generated by <a href="https://github.com/jsdoc/jsdoc">JSDoc 3.6.6</a> on Sat Dec 19 2020 20:20:16 GMT+0000 (Greenwich Mean Time)
</footer>

<script> prettyPrint(); </script>
<script src="scripts/linenumber.js"> </script>
</body>
</html>