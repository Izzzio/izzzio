class TestContract extends Contract {
    init(){
        this.vars = new KeyValue('TestContract');
        super.init();
    }
    get contract(){
        return {"name":"TestContract"}
    }
    deploy() {
        console.log('DEPLOY');
        this.vars.put('t', 10);
    }
    call() {
        let t = Number(this.vars.get('t'));
        t++;
        console.log('CALLINGS', t);
        this.vars.put('t', t);
    }
    plus(a,b){
        console.log('PLUS',a,b);
        return Number(a)+Number(b);
    }
}
global.registerContract(TestContract);