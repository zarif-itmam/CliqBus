#include<iostream>
#include<fstream>
using namespace std;

ofstream out("./ROUTE_STAND.TXT");

int main(){
    for(int i=1;i<=8;i++){
        for(int j=1;j<=8;j++){
            out<<"INSERT INTO ROUTE_STAND VALUES(SEQ_ROUTE_STAND.NEXTVAL,"<<i<<","<<8*(i-1)+j<<");"<<endl;
        }
    }
}