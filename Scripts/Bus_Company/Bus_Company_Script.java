import java.io.*;

public class Bus_Company_Script {
    public static void main(String[] args) throws Exception{
        BufferedReader br=new BufferedReader(new FileReader(new File("./info.txt")));
        BufferedWriter bw=new BufferedWriter(new FileWriter(new File("./Bus_Company_Script.txt")));
        while(true){
            String s=br.readLine();
            if(s==null) break;
            String insertStatement="INSERT INTO BUS_COMPANY VALUES(SEQ_BUS_COMPANY.NEXTVAL,'"+s+"');";
            bw.write(insertStatement);
            bw.newLine();
        }
        bw.close();
        br.close();
    }
}
