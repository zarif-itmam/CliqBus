#include<iostream>
#include<fstream>
using namespace std;

ofstream out1("./routes.txt");

int main(){
    for(int i=1;i<=8;i++){
        out1<<"INSERT INTO ROUTE VALUES(SEQ_ROUTE.NEXTVAL,"<<8*(i-1)+1<<","<<8*i<<");"<<endl;
    }
}
