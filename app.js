const { Console } = require('console')
const express = require('express')
const app = express()
const port = 3000

const https = require('https')

const options = {
  hostname: 'api.binance.com',
  port: 443,
  path: '/api/v3/klines?symbol=BTCUSDT&interval=5m&limit=1000',
  method: 'GET',
  headers: {
    'X-MBX-APIKEY' : 'YOUR-API-KEY'
  }
}


app.get('/', (req, res) => {
  res.send('Hello World!')
})


app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)

  GatherData()
})

async function GatherData(){
  options.path = '/api/v3/klines?symbol=BTCUSDT&interval=5m&limit=1000'
  await makeRequest("CANDLES")

  options.path = '/api/v3/depth?symbol=BTCUSDT&limit=5000'
  await makeRequest("VOLUMES")
}


function makeRequest(RequestedData){
  const req = https.request(options, res => {
    console.log(`statusCode: ${res.statusCode}`)
    var mystring;
    res.on('data', d => { //Data comes in chunks, have to store it until it reaches the end
      mystring += d
    })
    res.on('end', () => {
      mystring = mystring.slice(9, mystring.length) // Slice first 10 elements, because it's undefined

      if(RequestedData == "CANDLES"){
        const historicalData = getHistoricalData(JSON.parse(mystring)); //Send JSON Parsed response(only closed prices) and get the data in an array

        const crypto = new Crypto();

        const historicalValues = MakeObject(mystring);  //All response parsed
        for(var i = 0; i < 2; i++){
          i == 0 ? interval = 10 : interval = 20;
          const ema = new EMA(historicalData, interval);
          ema.CalculateAllEMA();

          for(var j = 0; j < historicalValues.length; j++){
            if(i == 0){ // If it's zero, then it's the 10 day EMA
                        // Make a candle from the already existing values and store it
              crypto.AddCandle(new Candle(historicalValues[j][0],historicalValues[j][1],historicalValues[j][2],historicalValues[j][3],historicalValues[j][4],historicalValues[j][5],historicalValues[j][6],historicalValues[j][7], ema.AllEMA[j], 0));
            } else {  // Second iteration means its the 20 day EMA, store its value
              crypto.Candles[j].TwentyDayEMA = ema.AllEMA[j];          
            }
          }
        }
        crypto.CalcRSI();
        crypto.Show();
      }

      else if(RequestedData == "VOLUMES"){
        let historicalData = JSON.parse(mystring);
        for (let i = 0; i < historicalData.length; i++) {
          console.log(historicalData.asks[i])
        }
      }
    })
  })

  req.on('error', error => {
    console.error(error)
  })

  req.end()

}

function MakeObject(mystring){
    mystring = JSON.parse(mystring);  //Response parsed as JSON
    mystring.slice(0,10); //Remove first 10 elements, because it would interfere with SMA calculation
    return mystring;
}


function getHistoricalData(dataReceived){
  var dataCapturedLocal = [];
  dataReceived.map(x => dataCapturedLocal.push(parseFloat(x[4])));
  return dataCapturedLocal;
}


class Crypto {
  Candles = [];

  AddCandle(candle){
    this.Candles.push(candle);
  }

  Show(){
    this.Candles.map(x => console.log("Close: " + x.Close+ "; 10Day EMA: " + x.TenDayEMA + "; 20Day EMA: " + x.TwentyDayEMA + "; RSI: " + x.RSIVal))
  }

  ShowClose(){
    this.Candles.map(x => console.log(x.Close))
  }
  CalcRSI(){
    var RS;
    var interval = 14;
    var AvgGain = [];
    var AvgLoss = [];

    for(var i = 1; i < this.Candles.length; i++){

      if((this.Candles[i].Close - this.Candles[i-1].Close) > 0){    // if the current is higher than the last one then its a gain





      if((this.Candles[i].Close - this.Candles[i-1].Close) > 0){    // if the current is higher than the last one then its a gain
        AvgGain.push(parseFloat(this.Candles[i].Close - this.Candles[i-1].Close))
        AvgLoss.push(0)
      }else{  // else its a loss, but in order for this to work, every array should always be the same size (hence 0's)
        AvgLoss.push(parseFloat(this.Candles[i].Close - this.Candles[i-1].Close))
        AvgGain.push(0)
      }

      if(i > interval - 1){ // when it already has the current 14 values
        var AvgGainVal = 0;
        var AvgLossVal = 0;
        for(var j = 0; j < AvgGain.length-2; j++)
          AvgGainVal += AvgGain[j]
        for(var k = 0; k < AvgLoss.length-2; k++)
          AvgLossVal += AvgLoss[k]
        
        if(i == 14){
          var AvgGainStart = 0;
          var AvgLossStart = 0;
          AvgGain.map(x => AvgGainStart += x)
          AvgLoss.map(x => AvgLossStart += x)
          RS = (AvgGainStart / interval) / (Math.abs(AvgLossStart) / interval)
        }else{
          RS = (((AvgGainVal * 13) + AvgGain[AvgGain.length-1]) / interval) / (((Math.abs(AvgLossVal) * 13) + AvgLoss[AvgLoss.length-1]) / interval)
        }
        this.Candles[i].RSIVal = 100 - (100 / (1 + RS));

        AvgGain.shift();
        AvgLoss.shift();

      }
    }

    // RSI = 100 - (100/1+RS)
    // RS = Average Gain / Average Loss
    // Average Gain / Loss Calc: Sum(Trend) / interval
  }

  
  /*
  ConvertEpochToSpecificTimezone(timeEpoch, offset){
    var d = new Date(timeEpoch);
    var utc = d.getTime() + (d.getTimezoneOffset() * 60000);  //This converts to UTC 00:00
    var nd = new Date(utc + (3600000*offset));
    return nd.toLocaleString();
  }*/
}

class Candle{
  Time;
  Open;
  High;
  Low;
  Close;
  VolumeInit;
  CloseTime;
  VolumeUSDT;
  TenDayEMA;
  TwentyDayEMA;
  RSIVal;

  constructor(time, open, high, low, close, VolumeInit, closetime, volumeusdt, ten, twenty){
    this.Time = time;
    this.Open = open;
    this.High = high;
    this.Low = low;
    this.Close = close;
    this.VolumeInit = VolumeInit;
    this.CloseTime = closetime;
    this.VolumeUSDT = volumeusdt;
    this.TenDayEMA = ten;
    this.TwentyDayEMA = twenty;
  }
}


class SMA {
  OldData;
  Dividend;
  ResultSMA;

  constructor(initData, interval){
    this.OldData = initData;
    this.Dividend = interval;
    this.ResultSMA = this.CalcSMA();
  }

  CalcSMA(){ // SMA = ( Sum ( Price, n ) ) / n
    let Sum = 0;

    for(var i = 0; i < 10; i++){
      Sum += this.OldData[i];
    }
    this.OldData.slice(0,10)
    return Sum/this.Dividend;
  }
}

class EMA extends SMA {
  Weight;

  CurrentEMA;
  ResultEMA;
  AllEMA = [];

  constructor(initData, interval){
    super(initData, interval);
    this.CurrentEMA = this.ResultSMA;
    this.Weight = 2 / (this.Dividend + 1);
  }

  CalculateAllEMA(){
    this.OldData.map(x => this.CalculateEMA(x))
    this.ResultEMA = this.CurrentEMA;
  }

  CalculateEMA(CurrentPrice){
    this.CurrentEMA = ((CurrentPrice - this.CurrentEMA) * this.Weight) + this.CurrentEMA;
    this.AllEMA.push(parseFloat(this.CurrentEMA));
  }
}